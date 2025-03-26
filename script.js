// Criar variável global para o mapa
window.map = null;
window.pubEnv = 'LOCAL';

// Inicializar Set de municípios participantes
window.participatingMunicipalities = new Set();

// Mover getColor para escopo global
window.getColor = function(feature) {
    if (!feature || !feature.properties) return '#fff8db';
    const cod_ibge = parseInt(feature.properties.id);
    return window.participatingMunicipalities.has(cod_ibge) ? '#12447F' : '#fff8db';
};

// Adicionar referência global para a camada GeoJSON
window.geoJSONLayer = null;

async function initializeMap(bounds) {
    const map = L.map('map', {
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        minZoom: 7.35,
        maxZoom: 8,
        bounceAtZoomLimits: true,
        attributionControl: false,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false
    });

    addTileLayer(map);
    return map;
}

async function initializeApplication() {
    // Map Configuration
    const mapConfig = {
        bounds: {
            southWest: [-7.86, -41.42],
            northEast: [-2.78, -37.25]
        },
        center: [-4.77500000, -37.24583333],
        style: {
            color: '#333333',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.35,
            fillColor: '#fff8db'
        }
    };

    const cearaBounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.southWest),
        L.latLng(mapConfig.bounds.northEast)
    );

    try {
        // Depois inicializar o mapa
        window.map = await initializeMap(cearaBounds);

        // Por fim, carregar o GeoJSON
        await loadGeoJSON(window.map, mapConfig.style);

        // Carregar dados dos municípios apenas depois que o mapa estiver pronto
        await carregarMunicipios();
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }

    // Setup Event Listeners
    setupEventListeners();
    
    // Initialize UI
    updateProgress();
    disableMapControls(window.map);
}

document.addEventListener('DOMContentLoaded', initializeApplication);

function addTileLayer(map) {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '',
        subdomains: 'abcd',
        // maxZoom: 19,
        opacity: 0.5
    }).addTo(map);
}

async function loadGeoJSON(map, style) {
    try {
        const response = await fetch('https://raw.githubusercontent.com/tbrugz/geodata-br/refs/heads/master/geojson/geojs-23-mun.json');
        const data = await response.json();
        console.log('geojson loaded');
        const geoLayer = createGeoJSONLayer(data, style);
        geoLayer.addTo(map);
        setupMapResponsiveness(map, geoLayer);
        return geoLayer;
    } catch (error) {
        console.error('Erro ao carregar o GeoJSON:', error);
        throw error;
    }
}

function createGeoJSONLayer(data, style) {
    window.geojson = data;
    window.geoJSONLayer = L.geoJSON(data, {
        style: function(feature) {
            return {
                ...style,
                fillColor: window.getColor(feature)
            };
        },
        onEachFeature: setupFeatureInteractions
    });
    return window.geoJSONLayer;
}

function setupFeatureInteractions(feature, layer) {
    if (feature.properties) {
        // Inicialmente adiciona um tooltip básico
        addBasicTooltip(layer, feature.properties.name);
        
        layer.on({
            mouseover: async (e) => {
                const codIbge = parseInt(layer.feature.properties.id);
                
                // Verifica se o município está na lista de participantes
                const isParticipating = window.participatingMunicipalities.has(codIbge);
                updateLayerOpacity(e.target, 1);
                console.log(e.target)
                updateLayerColor(e.target, isParticipating ? '#227AB8' : '#333');
                
                // Atualiza o tooltip com dados completos se necessário
                await updateTooltipWithFullData(e.target);
            },
            mouseout: (e) => {
                const codIbge = parseInt(layer.feature.properties.id);
                
                // Verifica se o município está na lista de participantes
                const isParticipating = window.participatingMunicipalities.has(codIbge);
                // Only reset opacity on mouseout if this isn't the currently selected layer
                const selectedLayer = window.selectedLayer;
                updateLayerColor(e.target, isParticipating ? '#3D8CC3' : '#f7f4e9');
                if (!selectedLayer || e.target !== selectedLayer) {
                    updateLayerOpacity(e.target, 0.5);
                }
            },
            click: (e) => {
                // Store the currently selected layer
                window.selectedLayer = e.target;
                
                // Reset all layers to default opacity
                if (window.geoJSONLayer) {
                    window.geoJSONLayer.eachLayer((l) => {
                        updateLayerOpacity(l, 0.35);
                    });
                }
                
                // Set the clicked layer to full opacity
                updateLayerOpacity(e.target, 1);
                
                // Get the IBGE code and call your update function
                const cod_ibge = parseInt(e.target.feature.properties.id);
                atualizarMunicipioSelecionado(cod_ibge, 'mapa');
            },
            onfocus: (e) => updateLayerOpacity(e.target, 1),
            blur: (e) => {
                // Only reset opacity on blur if this isn't the currently selected layer
                const selectedLayer = window.selectedLayer;
                if (!selectedLayer || e.target !== selectedLayer) {
                    updateLayerOpacity(e.target, 0.35);
                }
            }
        });
    }
}

function addBasicTooltip(layer, name) {
    layer.bindTooltip(`
        <div class="non-participating">
            <div class="tooltip-title">${name}</div>
            <div class="tooltip-description">Carregando dados do município...</div>
        </div>
    `, {
        direction: 'bottom-right',
        opacity: 1,
        offset: L.point(10, 30),
        className: 'custom-tooltip non-participating',
        permanent: false,
        sticky: true
    });
}

// Verificar se o município tem os dados necessários para ser mostrado como participante
function isValidParticipatingMunicipio(municipioData) {
    // Verificar se temos os dados básicos necessários
    if (!municipioData || typeof municipioData !== 'object') {
        console.log("Município sem dados válidos");
        return false;
    }
    
    // Verificar se temos points
    if (municipioData.points === undefined || municipioData.points === null) {
        console.log("Município sem pontos definidos:", municipioData);
        return false;
    }
    
    return true;
}

async function updateTooltipWithFullData(layer) {
    const codIbge = parseInt(layer.feature.properties.id);
    const name = layer.feature.properties.name;
    
    // Verifica se o município está na lista de participantes
    const isParticipating = window.participatingMunicipalities.has(codIbge);
    
    // Busca os dados do município
    const municipioData = window.municipiosData?.find(m => 
        parseInt(m.codIbge) === codIbge
    );

    let tooltipContent;
    const isValid = isParticipating && isValidParticipatingMunicipio(municipioData);
    
    if (isValid) {
        // Município participante com dados
        const nivel = Math.floor(municipioData.points / 100) + 1;
        const pontosNivel = municipioData.points % 100;
        tooltipContent = `
            <div class="tooltip-participating">
                <h3>${name}</h3>
                <div class="level-info">
                    <span>Nível ${nivel}</span>
                    <span class="progress-count">${pontosNivel}/100 <i class="fas fa-star"></i></span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${pontosNivel}%;"></div>
                </div>
                <div class="stats">
                    <div class="stat-item">
                        <i class="fas fa-star"></i>
                        <span>${municipioData.points} pontos</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-medal"></i>
                        <span>${municipioData.badges || 0} emblemas</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Município não participante
        tooltipContent = `
            <div class="non-participating">
                <div class="tooltip-title">${name}</div>
                <div class="tooltip-description">Este município não aderiu ao <br/> Pacto da Primeira Infância.</div>
            </div>
        `;
    }

    // Atualiza o tooltip existente
    layer.setTooltipContent(tooltipContent);
    
    // Atualiza a classe do tooltip
    const tooltip = layer.getTooltip();
    if (tooltip) {
        tooltip.setContent(tooltipContent);
        tooltip.options.className = isValid 
            ? 'custom-tooltip participating' 
            : 'custom-tooltip non-participating';
    }
}

function addLayerEventListeners(layer) {
    layer.on({
        mouseover: (e) => updateLayerOpacity(e.target, 1),
        mouseout: (e) => updateLayerOpacity(e.target, 0.35),
        click: (e) => updateMunicipalityInfo(e.target.feature.properties.id),
        onfocus: (e) => updateLayerOpacity(e.target, 1),
        blur: (e) => updateLayerOpacity(e.target, 0.35),
    });
}

function updateLayerOpacity(layer, opacity) {
    layer.setStyle({ fillOpacity: opacity });
}

function updateLayerColor(layer, color) {
    layer.setStyle({ fillColor: color });
}

function setupMapResponsiveness(map, geoLayer) {
    const fitMapToBounds = () => {
        // Don't process if on mobile
        if (window.innerWidth <= 767) return;

        const bounds = geoLayer.getBounds();
        const isSmallScreen = window.innerWidth <= 1024;
        const containerWidth = map.getContainer().offsetWidth;
        const containerHeight = map.getContainer().offsetHeight;
        
        // Adjusted padding calculations for different screen sizes
        let basePadding, finalZoomRange;
        if (isSmallScreen) {
            basePadding = Math.min(containerWidth, containerHeight) * 0.08;
            finalZoomRange = { min: 6.0, max: 6.5 };
        } else {
            basePadding = Math.min(containerWidth, containerHeight) * 0.05;
            finalZoomRange = { min: 6.2, max: 7.2 };
        }
        
        // Initial bounds fit
        map.invalidateSize();
        map.fitBounds(bounds, {
            padding: [basePadding, basePadding],
            animate: false,
            maxZoom: finalZoomRange.max
        });
        
        // Fine-tune the fit
        requestAnimationFrame(() => {
            const currentZoom = map.getZoom();
            const geoJsonWidth = bounds.getEast() - bounds.getWest();
            const geoJsonHeight = bounds.getNorth() - bounds.getSouth();
            
            // Calculate ratios
            const effectiveWidth = containerWidth - (basePadding * 1.5);
            const effectiveHeight = containerHeight - (basePadding * 1.5);
            const widthRatio = effectiveWidth / geoJsonWidth;
            const heightRatio = effectiveHeight / geoJsonHeight;
            
            // Adjust ratio based on screen size
            const ratio = Math.min(widthRatio, heightRatio) * (isSmallScreen ? 1.02 : 1.05);
            let adjustedZoom = currentZoom;
            
            // Zoom adjustment based on screen size
            if (ratio < 1) {
                adjustedZoom -= Math.abs(Math.log2(ratio)) * (isSmallScreen ? 0.9 : 0.95);
            } else if (ratio > (isSmallScreen ? 1.5 : 1.8)) {
                adjustedZoom += Math.log2(ratio) * (isSmallScreen ? 0.5 : 0.6);
            }
            
            // Clamp zoom level based on screen size
            const finalZoom = Math.min(
                Math.max(adjustedZoom, finalZoomRange.min),
                finalZoomRange.max
            );
            
            // Apply zoom
            map.setZoom(finalZoom);
            
            // Adjust center position
            const center = bounds.getCenter();
            const offsetLat = (bounds.getNorth() - bounds.getSouth()) * (isSmallScreen ? 0.01 : 0.02);
            const offsetLng = (bounds.getEast() - bounds.getWest()) * (isSmallScreen ? 0.01 : 0.02);
            map.panTo([center.lat - offsetLat, center.lng - offsetLng]);
            
            // Final bounds check
            const currentBounds = map.getBounds();
            if (!currentBounds.contains(bounds)) {
                map.fitBounds(bounds, {
                    padding: [basePadding * (isSmallScreen ? 1.05 : 1.1), 
                             basePadding * (isSmallScreen ? 1.05 : 1.1)],
                    animate: false,
                    maxZoom: finalZoom
                });
            }
        });
    };

    // Initial fit only if not mobile
    if (window.innerWidth > 767) {
        map.invalidateSize();
        fitMapToBounds();
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Resize handler with debounce
    window.addEventListener('resize', debounce(() => {
        if (window.innerWidth > 767) {
            fitMapToBounds();
        }
    }, 250));

    // ResizeObserver with debounce
    const observer = new ResizeObserver(debounce(() => {
        if (window.innerWidth > 767) {
            fitMapToBounds();
        }
    }, 250));

    observer.observe(document.querySelector('.map-container'));
}

function setupEventListeners() {
    const select = document.getElementById('municipios');
    select.addEventListener('change', function() {
        const selectedValue = this.value;
        if (selectedValue) {
            // Convert selectedValue to IBGE code format if needed
            const cod_ibge = parseInt(selectedValue);
            console.log({cod_ibge})

            

            if (window.selectedLayer) {
                updateLayerOpacity(window.selectedLayer, 0.35);
            }

            const newSelectedLayer = findLayerByIBGECode(cod_ibge);

            console.log({newSelectedLayer})
            
            // If we found a valid layer
            if (newSelectedLayer) {
                // Update opacity and store as the selected layer
                updateLayerOpacity(newSelectedLayer, 1);
                window.selectedLayer = newSelectedLayer;
            }
            
            // Update municipality based on select change

            atualizarMunicipioSelecionado(cod_ibge, 'select');
        }
    });

    const concluirBtns = document.querySelectorAll('.concluir-btn');
    concluirBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            completeMission(this.closest('.missao-item'));
        });
    });
}

function disableMapControls(map) {
    map.removeControl(map.zoomControl);
    map.getContainer().setAttribute('tabindex', '-1');
    map.getContainer().style.outline = 'none';

    map.on('layeradd', function(e) {
        if (e.layer instanceof L.Path) {
            e.layer.getElement().setAttribute('tabindex', '-1');
        }
    });

    document.querySelectorAll('.leaflet-interactive, .leaflet-control-container *, .leaflet-control a')
        .forEach(element => {
            element.setAttribute('tabindex', '-1');
        });
}

// UI Update Functions
function completeMission(missionItem) {
    missionItem.classList.add('completed');
    
    const status = document.createElement('span');
    status.className = 'status';
    status.innerHTML = '<i class="fas fa-check-circle"></i> MISSÃO CONCLUÍDA';
    
    const button = missionItem.querySelector('.concluir-btn');
    button.replaceWith(status);
    
    updateProgress();
    updatePoints(missionItem);
}

function updatePoints(missionItem) {
    const pointsText = missionItem.querySelector('.points').textContent;
    const points = parseInt(pointsText);
    const currentPoints = parseInt(document.querySelector('.stat-item .number').textContent);
    
    document.querySelector('.stat-item .number').textContent = currentPoints + points;
}

function updateProgress() {
    const completedMissions = document.querySelectorAll('.missao-item.completed').length;
    const totalMissions = document.querySelectorAll('.missao-item').length;
    const progress = (completedMissions / totalMissions) * 100;
    
    document.querySelector('.progress').style.width = progress + '%';
}

function updateMunicipalityInfo(cod_ibge) {
    atualizarMunicipioSelecionado(cod_ibge, 'mapa');
}

function scrollToTop() {
    // Verifica se está em modo responsivo (menor que 1024px)
    if (window.innerWidth <= 1024) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        document.querySelector('.right-panel').scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function findLayerByIBGECode(ibgeCode) {
    let targetLayer = null;
    
    if (window.geoJSONLayer) {
        window.geoJSONLayer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties && 
                parseInt(layer.feature.properties.id) === parseInt(ibgeCode)) {
                targetLayer = layer;
            }
        });
    }
    
    return targetLayer;
}

function setMunicipalityOpacity(ibgeCode, opacity) {
    const layer = findLayerByIBGECode(ibgeCode);
    if (layer) {
        updateLayerOpacity(layer, opacity);
        return true;
    }
    return false;
}


// Função para atualizar município selecionado (chamada pelo mapa ou select)
function atualizarMunicipioSelecionado(cod_ibge, source) {
    // Reset previous selection opacity
    if (window.selectedLayer) {
        updateLayerOpacity(window.selectedLayer, 0.35);
    }
    
    // Find the layer corresponding to the selected IBGE code
    const newSelectedLayer = findLayerByIBGECode(cod_ibge);

    console.log({newSelectedLayer})
    
    // If we found a valid layer
    if (newSelectedLayer) {
        // Update opacity and store as the selected layer
        updateLayerOpacity(newSelectedLayer, 1);
        window.selectedLayer = newSelectedLayer;
        
        // If this was triggered by map click, update the select box
        if (source === 'mapa') {
            const select = document.getElementById('municipios');
            select.value = cod_ibge;
        }
        
        // If this was triggered by select, pan the map to the selected municipality
        if (source === 'select') {
            window.map.panTo(newSelectedLayer.getBounds().getCenter());
        }

       // buscarDadosMunicipio(cod_Ibge);

        
        // Log the change for debugging
        console.log(`Municipality updated: ${newSelectedLayer.feature.properties.name} (${cod_ibge})`);
    } else {
        console.warn(`Could not find layer with IBGE code: ${cod_ibge}`);
    }
    
    // Your existing functionality for this function...
}

// Exportar funções para uso global
window.atualizarMunicipioSelecionado = atualizarMunicipioSelecionado;


// Tornar a função acessível globalmente
window.scrollToTop = scrollToTop;

// Function to get SVG icon component based on category
function getIconByCategoryId(category) {
    if (!category || typeof category !== 'string') {
        console.error('Invalid category provided:', category);
        return `<i class="fas fa-question-circle"></i>`;
    }
    
    const normalizedCategory = category.trim().toUpperCase();
    if (!normalizedCategory.match(/^(CTG-\d+|CTG\d+)$/)) {
        console.warn(`Category format invalid: ${category}. Expected format: CTGN or CTG-N`);
        return `<i class="fas fa-question-circle"></i>`;
    }
    
    const filteredCategory = normalizedCategory.replace(/-/g, '');
    const actualEnv = window.pubEnv;

    const pngPath = actualEnv == "LOCAL" ? `/public/icons/${filteredCategory}.png` : window.inlinedPNGs[filteredCategory]
  
    console.log({actualEnv, pngPath})

    return `
            <img src="${pngPath}" 
                 alt="Icon for ${filteredCategory}" 
                 class="category-icon"
                 onerror="this.onerror=null; this.src=''; this.style.display='none'; this.parentNode.innerHTML='<i class=\'fas fa-cogs\'></i>';">
    `;
}

// Function to insert SVG icon into DOM element
function insertCategoryIcon(element, category) {
    if (!element) {
        console.error('No element provided to insert icon into');
        return;
    }
    
    const iconComponent = getIconByCategoryId(category);
    element.innerHTML = iconComponent;
}

// Make functions available globally
window.getIconByCategoryId = getIconByCategoryId;
window.insertCategoryIcon = insertCategoryIcon;

// Verificar a função atualizarCorMapa para garantir que não está sobrescrevendo os dados
function atualizarCorMapa(municipios) {
    if (!window.map || !window.geoJSONLayer) {
        console.error('Mapa ou camada GeoJSON não inicializados');
        return;
    }

    console.log("Atualizando cor do mapa com municipios:", municipios.length);
    console.log("Antes da atualização, participatingMunicipalities tem:", 
                window.participatingMunicipalities ? window.participatingMunicipalities.size : 0, 
                "municípios");
    
    // Preservar Set existente se já tiver sido criado
    if (!window.participatingMunicipalities) {
        window.participatingMunicipalities = new Set(
            municipios.map(m => parseInt(m.codIbge))
        );
    }
    
    console.log("Depois da atualização, participatingMunicipalities tem:", 
                window.participatingMunicipalities.size, 
                "municípios");
    
    // Atualizar estilos de todas as features
    window.geoJSONLayer.eachLayer(function (layer) {
        if (layer.feature && layer.feature.properties) {
            const id = parseInt(layer.feature.properties.id);
            const isParticipating = window.participatingMunicipalities.has(id);
            
            layer.setStyle({
                fillColor: isParticipating ? '#12447F' : '#fff8db',
                fillOpacity: 0.35,
                color: '#333333',
                weight: 2,
                opacity: 0.8
            });
        }
    });
}

async function carregarMunicipios() {
    toggleLoading(true);
    const inicio = performance.now();
    try {
        const response = await fetch(API_BASE_URL + '/municipios');
        if (!response.ok) throw new Error('Erro ao carregar municípios');
        const data = await response.json();
        medirTempoResposta(inicio);
        
        if (data.status === 'success') {
            console.log("Dados recebidos da API:", data.data.length, "municípios");
            
            // Armazenar dados globalmente
            window.municipiosData = data.data;
            
            // Criar Set de municípios participantes
            window.participatingMunicipalities = new Set(
                data.data.map(m => parseInt(m.codIbge))
            );
            
            console.log("Municípios participantes:", window.participatingMunicipalities.size);
            
            // Verificar alguns dados de municípios para diagnóstico
            if (data.data.length > 0) {
                const amostra = data.data.slice(0, 3);
                console.log("Amostra de dados:", amostra);
            }
            
            // Atualizar select e cor do mapa
            popularSelectMunicipios(data.data);
            
            // Atualizar cores do mapa sem sobrescrever Set de participantes
            atualizarCorMapa(data.data);
            
            // Atualizar todos os tooltips após carregar os dados
            console.log("Atualizando tooltips...");
            if (window.geoJSONLayer) {
                window.geoJSONLayer.eachLayer(layer => {
                    if (layer.feature && layer.feature.properties) {
                        updateTooltipWithFullData(layer);
                    }
                });
            }
            
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Erro:', error);
        throw error;
    } finally {
        toggleLoading(false);
    }
}
