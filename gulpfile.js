const gulp = require("gulp");
const htmlmin = require("gulp-htmlmin");
const concat = require("gulp-concat");
const cleanCSS = require("gulp-clean-css");
const uglify = require("gulp-uglify");
const replace = require("gulp-replace");
const fs = require("fs");
const terser = require("gulp-terser");
const path = require("path");

// Helper function to encode files as Base64
function encodeFileToBase64(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath).toString("base64") : "";
}

// Helper function to get all PNG files in a directory
function getPngFiles(directory) {
    const pngFiles = {};
    if (fs.existsSync(directory)) {
        fs.readdirSync(directory).forEach(file => {
            if (path.extname(file).toLowerCase() === '.png') {
                const filePath = path.join(directory, file);
                const fileName = path.basename(file, '.png');
                // For PNG files, we store the Base64 encoded content
                pngFiles[fileName] = fs.readFileSync(filePath).toString("base64");
            }
        });
    }
    return pngFiles;
}

// Minify and inline CSS
gulp.task("inline-css", function () {
    return gulp.src("*.css")
        .pipe(cleanCSS({ compatibility: "ie8" }))
        .pipe(concat("styles.min.css"))
        .pipe(gulp.dest("dist"))
        .on("end", function () {
            global.inlineCSS = fs.readFileSync("dist/styles.min.css", "utf8");
        });
});

// Process JS files separately first to keep them intact
gulp.task("process-js", function () {
    // Create an array with the correct order of JS files
    const jsFiles = ["script.js", "data-loader.js"];
    
    // Check if files exist and add them to the stream
    const existingFiles = jsFiles.filter(file => fs.existsSync(file));
    
    return gulp.src(existingFiles)
        .pipe(concat("scripts.combined.js"))
        .pipe(gulp.dest("dist"));
});

// Then minify with terser which handles modern JS better
gulp.task("minify-js", gulp.series("process-js", function () {
    return gulp.src("dist/scripts.combined.js")
        .pipe(terser({
            ecma: 5,
            compress: false,
            mangle: false,
            format: {
                beautify: true,
                quote_style: 1
            }
        }))
        .pipe(concat("scripts.min.js"))
        .pipe(gulp.dest("dist"))
        .on("end", function () {
            try {
                let jsCode = fs.readFileSync("dist/scripts.min.js", "utf8");
                global.inlineJS = jsCode;
            } catch (err) {
                console.error("Error reading minified JS:", err);
                global.inlineJS = "console.error('Error loading scripts');";
            }
        });
}));

// Process PNG files
gulp.task("process-png", function(done) {
    // Store PNG files in a global variable
    global.pngFiles = getPngFiles("public/icons"); // Using the same directory structure
    
    // Create a JS snippet to make PNGs available to the script
    let pngLoaderScript = "window.inlinedPNGs = {};\n";
    for (const [name, content] of Object.entries(global.pngFiles)) {
        pngLoaderScript += `window.inlinedPNGs["${name}"] = "data:image/png;base64,${content}";\n`;
    }
    
    // Store the loader script
    global.pngLoaderScript = pngLoaderScript;
    done();
});

// Minify HTML and inline CSS, JS, image, JSON, and PNGs
gulp.task("inline-html", function () {
    const imageBase64 = encodeFileToBase64("public/caninde.png");
    const jsonBase64 = encodeFileToBase64("public/geojs-23-mun.json");
    
    // Read the original HTML
    const originalHtml = fs.readFileSync("index.html", "utf8");
    
    // Extract and preserve the head section
    const headMatch = originalHtml.match(/<head>[\s\S]*?<\/head>/);
    const headContent = headMatch ? headMatch[0] : '';
    
    // Replace only our local CSS in the head content
    const modifiedHead = headContent.replace(
        /<link rel="stylesheet" href="styles\.css">/,
        `<style>${global.inlineCSS}</style>`
    );

    // Combine the JS with the PNG loader script
    const combinedJS = global.pngLoaderScript + "\n" + global.inlineJS;

    return gulp.src("index.html")
        .pipe(htmlmin({ 
            collapseWhitespace: true, 
            removeComments: true,
            minifyJS: false,
            minifyCSS: false
        }))
        .pipe(replace(/<head>[\s\S]*?<\/head>/, modifiedHead))
        // Replace all img references to local icons with inlinedPNGs references - with leading slash
        .pipe(replace(/src=["']\/public\/icons\/([^"'\.]+)(\.png)?["']/g, function(match, iconName) {
            // Use window.inlinedPNGs with the icon name
            return `src="' + window.inlinedPNGs["${iconName}"] + '"`;
        }))
        // Handle without leading slash
        .pipe(replace(/src=["']public\/icons\/([^"'\.]+)(\.png)?["']/g, function(match, iconName) {
            return `src="' + window.inlinedPNGs["${iconName}"] + '"`;
        }))
        // This is the key fix - updated to correctly match both script.js and data-loader.js tags
        .pipe(replace(/<script src="script\.js"><\/script>[\s\S]*?<script src="data-loader\.js"><\/script>/, () => {
            return `<script>${combinedJS}</script>`;
        }))
        .pipe(replace(/src="public\/caninde\.png"/, `src="data:image/png;base64,${imageBase64}"`))
        .pipe(replace(/fetch\("public\/geojs-23-mun\.json"\)/, `fetch\("data:application/json;base64,${jsonBase64}"\).then(res => res.json())`))
        .pipe(gulp.dest("dist"));
});

// Additional task to replace img references in JS files
gulp.task("replace-img-in-js", function() {
    return gulp.src(["dist/scripts.combined.js"])
        // Handle paths with leading slash
        .pipe(replace(/(['"])\/public\/icons\/([^'"\.]+)(\.png)?(['"])/g, function(match, quote1, iconName, ext, quote2) {
            return `${quote1}' + window.inlinedPNGs["${iconName}"] + '${quote2}`;
        }))
        // Handle paths without leading slash
        .pipe(replace(/(['"])public\/icons\/([^'"\.]+)(\.png)?(['"])/g, function(match, quote1, iconName, ext, quote2) {
            return `${quote1}' + window.inlinedPNGs["${iconName}"] + '${quote2}`;
        }))
        .pipe(terser({
            ecma: 5,
            compress: false,
            mangle: false,
            format: {
                beautify: true,
                quote_style: 1
            }
        }))
        .pipe(concat("scripts.min.js"))
        .pipe(gulp.dest("dist"))
        .on("end", function() {
            try {
                global.inlineJS = fs.readFileSync("dist/scripts.min.js", "utf8");
            } catch (err) {
                console.error("Error reading updated JS:", err);
            }
        });
});

// Run tasks in sequence (primary method)
gulp.task("default", gulp.series("inline-css", "process-js", "process-png", "replace-img-in-js", "inline-html"));