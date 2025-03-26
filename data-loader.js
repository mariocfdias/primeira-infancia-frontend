// URL base para as requisições
const API_BASE_URL = 'https://primeira-infancia-backend.onrender.com/api';

// Função para medir tempo de resposta
function medirTempoResposta(inicio) {
    const fim = performance.now();
    console.log('Tempo de resposta: ' + (fim - inicio).toFixed(2) + 'ms');
}

// Função para mostrar/esconder loading
function toggleLoading(show) {
    const mapContainer = document.querySelector('.map-container');
    const loadingOverlays = document.querySelectorAll('.loading-overlay:not(.skeleton-content)');
    
    // Remover overlays existentes
    loadingOverlays.forEach(overlay => overlay.remove());
    
    if (show) {
        // Criar e adicionar overlay de loading apenas para o mapa
        const mapOverlay = createLoadingOverlay();
        mapContainer.appendChild(mapOverlay);
        mapContainer.classList.add('loading');
    } else {
        mapContainer.classList.remove('loading');
    }
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    return overlay;
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
                fillColor: isParticipating ? '#227AB8' : '#f7f4e9',
                fillOpacity: 0.5,
                color: isParticipating ? '#ffffff' : '#333333',
                weight: 0.8,
                opacity: 1
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

            console.log(window.municipiosData)
            
            // Criar Set de municípios participantes
            window.participatingMunicipalities = new Set(
                data.data.filter(m => m.status === 'Participante' && !isNaN(m.codIbge)).map(m => parseInt(m.codIbge))
            );
            
            console.log("Municípios participantes:", window.participatingMunicipalities.size);
            
            // Verificar alguns dados de municípios para diagnóstico
            if (data.data.length > 0) {
                const amostra = data.data.slice(0, 3);
                console.log("Amostra de dados:", amostra);
            }
            
            // Atualizar select e cor do mapa
            popularSelectMunicipios(data.data.filter(m => m.status === 'Participante' && !isNaN(m.codIbge)));
            
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
        popularLayer()
        toggleLoading(false);
    }
}

function popularLayer(municipios, layerList) {
    if (!municipios) {
        municipios = window.municipiosData;
    }

    if (!layerList) {
        layerList = window.geoJSONLayer;
    }

    var biggestMunicipioValue = Math.max(...municipios.map(m => m.points))
    console.log(window.map)
    layerList.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            layer.feature.properties.pontos = municipios.find(m => m.codIbge == layer.feature.properties.id).points / biggestMunicipioValue;
        }
    });
}

// Função para popular select de municípios
function popularSelectMunicipios(municipios) {
    const select = document.getElementById('municipios');
    select.innerHTML = '<option value="">Selecione um município</option>';
    
    municipios
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio.codIbge;
            option.textContent = municipio.nome;
            select.appendChild(option);
        });
}

function showSkeletonLoading() {
    const rightPanel = document.querySelector('.right-panel');
    rightPanel.style.position = 'relative'; // Ensure relative positioning
    
    rightPanel.innerHTML = `
        <div class="loading-overlay" style="position: fixed;">
            <div class="loading-spinner"></div>
        </div>
        <article class="municipality-section skeleton-content">
            <div class="municipality-header">
                <div class="skeleton skeleton-image"></div>
                <div class="municipality-info">
                    <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton skeleton-text" style="width: 40%;"></div>
                    <div class="level-header">
                        <div class="skeleton skeleton-text" style="width: 30%;"></div>
                    </div>
                    <div class="progress-bar skeleton"></div>
                </div>
            </div>
            <div class="stats">
                <div class="skeleton skeleton-text" style="width: 30%;"></div>
                <div class="skeleton skeleton-text" style="width: 30%;"></div>
            </div>
        </article>
        <article class="distintivos-section">
            <div class="skeleton skeleton-text" style="width: 40%;"></div>
            <div class="distintivos-grid">
                <div class="skeleton" style="height: 100px;"></div>
                <div class="skeleton" style="height: 100px;"></div>
                <div class="skeleton" style="height: 100px;"></div>
            </div>
        </article>
        <article class="missoes-section">
            <div class="skeleton skeleton-text" style="width: 50%;"></div>
            <div class="missao-list">
                <div class="skeleton" style="height: 150px; margin-bottom: 15px;"></div>
                <div class="skeleton" style="height: 150px; margin-bottom: 15px;"></div>
                <div class="skeleton" style="height: 150px;"></div>
            </div>
        </article>
    `;
}

function getCategoryBackground(categoryId) {
    const backgroundMap = {
        'CTG1': 'linear-gradient(to right, #3D5E85, #5E7DA0)',
        'CTG2': 'linear-gradient(to right, #256F93, #5B97B5)',
        'CTG3': 'linear-gradient(to right, #1C434F, #0A5166)'
    };
    
    return backgroundMap[categoryId] || backgroundMap['CTG1']; // Retorna o gradiente padrão se a categoria não existir
}

function updateRightMenu(data) {
    console.log({data})
    const rightPanel = document.querySelector('.right-panel');
    const municipio = data.municipio;
    const missoes = data.missoesMunicipio.missoes;
    const insignias = data.insigniasMunicipio;
    const numberInsignias = insignias.insignias.map(i => i.number).reduce((a, b) => a + b, 0);
    const nivel = Math.floor(insignias.points / 100) + 1;
    const pontosNivel = insignias.points % 100;
    
    // Atualizar o conteúdo imediatamente com uma imagem placeholder
    const municipalityHTML = `
        <article class="municipality-section">
            <div class="municipality-header">
                <div class="municipality-image skeleton">
                    <div class="municipality-image-placeholder"></div>
                    <img src="${getThumbnailUrl(municipio.imagem_avatar) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23f5f5f5"/%3E%3C/svg%3E'}" 
                         alt="${municipio.nome}"
                         class="municipality-image-real"
                         onerror="this.style.display='none'"
                         onload="this.parentElement.classList.remove('skeleton'); this.style.opacity = '1';"
                    />
                </div>
                <div class="municipality-info">
                    <h2>${municipio.nome}</h2>
                    <p>Agentes de Transformação</p>
                    <div class="level-header">
                        <h3>Nível ${nivel}</h3>
                        <div class="progress-count">${pontosNivel}/100 <i class="fas fa-star "></i></div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${pontosNivel}%;"></div>
                    </div>
                    <p class="progress-helper">Complete missões para ganhar pontos e subir de nível.</p>
                    <div class="stats">
                        <div class="stat-item pontos">
                            <div class="icon-box"><i class="fas fa-star fa-xl"></i></div>
                            <div class="stat-content">
                                <span class="number">${insignias.points}</span>
                                <span class="label">pontos</span>
                            </div>
                        </div>
                        <div class="stat-item emblemas">
                            <div class="icon-box"><i class="fas fa-medal fa-xl"></i></div>
                            <div class="stat-content">
                                <span class="number">${numberInsignias}</span>
                                <span class="label">emblemas</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;


    const categorias = ['CTG-1', 'CTG-2', 'CTG-3']; 


    const emblemasHTML = `
    <article class="distintivos-section">
        <h2>Emblemas</h2>
        <p class="emblema-subtitle">Complete missões para ganhar novos emblemas.</p>
        <div class="distintivos-grid">
            ${categorias.map(categoria => {
                const emblema = insignias?.insignias?.find(e => e.category.replace(/-/g, '') == categoria.replace(/-/g, ''));
                const count = emblema ? (emblema.number || 0) : 0;
                console.log(insignias.insignias)
                console.log({emblema, count})
                return `
                    <div class="distintivo ${count <= 0 ? 'empty' : ''}">
                        <div class="icon" data-count="${count}">
                            ${window.getIconByCategoryId(categoria)}
                        </div>
                        <p class="emblema-title">${emblema?.nome || ''}</p>
                    </div>
                `;
            }).join('')}
        </div>
    </article>
    <div class="section-divider"></div>
`;
    
    const missoesHTML = `
        <article class="missoes-section">
            <h2>Missões</h2>
            <p>Complete as missões para ganhar pontos e distintivos!</p>
            <div class="missao-list">
                ${missoes.map(missao => createMissionHTML(missao)).join('')}
            </div>
        </article>
        <div class="back-to-top">
            <button onclick="scrollToTop()">
                Voltar para o topo <i class="fas fa-chevron-up"></i>
            </button>
        </div>
    `;
    
    rightPanel.classList.add('fade-out');
    setTimeout(() => {
        rightPanel.innerHTML = municipalityHTML + emblemasHTML + missoesHTML;
        rightPanel.classList.remove('fade-out');
        rightPanel.classList.add('fade-in');
    }, 300);
}

function createMissionHTML(missao) {
    const isCompleted = missao.status_de_validacao === 'Validado';
    console.log({und: missao.missao})
    const categoryId = missao.missao.id_categoria || 'CTG-1';
    const background = getCategoryBackground(categoryId);
    const linkFormulario = missao.missao.link_formulario || '#';
    console.log({linkFormulario})
    
    return `
        <div class="missao-item ${isCompleted ? 'completed' : ''}">
            <div class="missao-header" style="background: ${background}; padding: 16px; color: white; position: relative; min-height: 120px; display: flex; align-items: stretch;">
                <div class="category-chip" style="background: ${background}; position: absolute; top: -12px; left: 16px; padding: 4px 12px; border-radius: 100px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <span class="category-description">${missao.missao.descricao_da_categoria}</span>
                </div>
                
                <div class="missao-icon">
                        ${window.getIconByCategoryId(categoryId)}
                </div>
                <div class="missao-content" style="width: 100%; margin-left: 8px;">
                    <div class="mission-description-wrapper">
                        <p class="mission-description" style="color: white; margin-top: 8px;">${missao.missao.descrição_da_missao}</p>
                    </div>
                    <div class="mission-status-wrapper" style="display: flex; justify-content: flex-end; gap: 12px; align-items: center;  width: 100%;">
                        ${isCompleted ? 
                            `<div class="status-chip" style=" padding: 4px 12px; border-radius: 100px; gap: 4px; display: flex; align-items: center;">
                                <span style="font-size: 18px; display: flex; align-items: center; gap: 4px; font-weight: 500; margin-left: 4px;">
                                    <i class="fas fa-check-circle"></i> <span style="margin-left: 4px;">Missão concluída</span>
                                </span>
                            </div>` : ''
                        }
                        <div class="points-chip" style="font-weight: bold; font-size: 16px; display: flex; align-items: center; gap: 4px;">
                            <span>+${missao.missao.qnt_pontos || "--"}</span>
                            <i class="fas fa-star fa-xl" aria-hidden="true" role="img"></i>
                        </div>
                    </div>
                </div>
            </div>
            <div class="evidence-section">
                <h3 class="evidence-title">Evidências</h3>
                <p class="evidence-description">${isCompleted ? 'Visualize as evidências enviadas para esta missão.' : 'Envie as evidências abaixo para concluir a missão.'}</p>
                <div class="evidence-grid">
                    ${missao.evidencias.filter(ev => ev.title && ev.description).map(ev => `
                        <${isCompleted ? 'a' : 'div'} 
                            class="evidence-item"
                            ${ev.evidencia ? `href="${ev.evidencia}" target="_blank" rel="noopener noreferrer"` : ''}
                            title="${ev.description || 'Sem descrição disponível'}">
                            <span>${ev.title || 'Evidência'}</span>
                            <i class="fa-solid  fa-${isCompleted ? 'external-link' : 'circle-info'} ${isCompleted ? '' : 'info-icon'} fa-xl" 
                               aria-hidden="true"
                               data-tooltip="${ev.description || 'Sem descrição disponível'}"></i>
                        </${isCompleted ? 'a' : 'div'}>
                    `).join('')}
                </div>
                ${!isCompleted ? `
                    <div class="evidence-divider"></div>
                    <div class="evidence-button-container">
                        <a href="${linkFormulario}" target="_blank" rel="noopener noreferrer" class="evidence-submit-btn">
                            Enviar evidências
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

let isLoading = false;

// Função para buscar dados do município selecionado (com skeleton loading)
async function buscarDadosMunicipio(codIbge) {
    if (isLoading) return;
    isLoading = true;

    const isParticipating = window.participatingMunicipalities.has(parseInt(codIbge));
    
    if (!isParticipating) {
        // Encontrar os dados do município usando window.municipiosData
        const municipioData = window.municipiosData?.find(m => parseInt(m.codIbge) === parseInt(codIbge));
        
        // Encontrar o nome do município usando o codIbge (fallback)
        const municipioLayer = findLayerByIBGECode(parseInt(codIbge));
        const municipioNome = municipioData?.nome || municipioLayer?.feature?.properties?.name || 'Município';

        const rightPanel = document.querySelector('.right-panel');
        
        // Adicionar overlay de loading
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
        rightPanel.appendChild(loadingOverlay);

        try {
            console.log(municipioData)
            rightPanel.innerHTML = `
                <article class="municipality-section">
                    <div class="municipality-header">
                        <div class="municipality-image skeleton">
                            <div class="municipality-image-placeholder"></div>
                            <img src="${getThumbnailUrl(municipioData?.imagemAvatar) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23f5f5f5"/%3E%3C/svg%3E'}"
                                 alt="${municipioNome}"
                                 class="municipality-image-real"
                                 onerror="this.style.display='none'"
                                 onload="this.parentElement.classList.remove('skeleton'); this.style.opacity = '1';"
                            />
                        </div>
                        <div class="municipality-info">
                            <h2>${municipioNome}</h2>
                            <div class="nao-participante">
                                <i class="fas fa-info-circle"></i>
                                <p>O município ainda não aderiu ao Pacto Cearense pela Primeira Infância.</p>
                            </div>
                            <button class="evidence-submit-btn" style="margin-top: 16px;">
                                Aderir agora
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </button>
                        </div>
                    </div>
                    <div id="chartContainer" style="width: 300px; height: 300px;"></div>
                </article>
            `;
        } finally {
            // Remover overlay de loading
            rightPanel.querySelector('.loading-overlay')?.remove();
            createPieChart('chartContainer');

            isLoading = false;
        }
        return;
    }

    const rightPanel = document.querySelector('.right-panel');
    const selectMunicipio = document.getElementById('municipios');

    // Desabilitar interações
    if (window.map) {
        window.map.dragging.disable();
        window.map.touchZoom.disable();
        window.map.doubleClickZoom.disable();
        window.map.scrollWheelZoom.disable();
        window.map.boxZoom.disable();
        window.map.keyboard.disable();
        window.map._handlers.forEach(handler => handler.disable());
        window.map.getContainer().style.pointerEvents = 'none';
    }
    if (selectMunicipio) selectMunicipio.disabled = true;
    
    // Add loading overlay without removing current content
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    rightPanel.appendChild(loadingOverlay);
    
    const inicio = performance.now();
    try {
        const response = await fetch(API_BASE_URL + '/municipios/' + codIbge);

        if (!response.ok) throw new Error('Erro ao carregar dados do município');
        
        const responseData = await response.json();
        medirTempoResposta(inicio);
        console.log('Dados do município:', responseData);
        
        if (responseData.data) {
            updateRightMenu(JSON.parse(responseData.data.json).data);
        }
        
        return responseData;
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        // Remove loading overlay
        rightPanel.querySelector('.loading-overlay')?.remove();
        // Reabilitar interações
        if (window.map) {
            window.map.dragging.enable();
            window.map.touchZoom.enable();
            window.map.doubleClickZoom.enable();
            window.map.scrollWheelZoom.enable();
            window.map.boxZoom.enable();
            window.map.keyboard.enable();
            window.map._handlers.forEach(handler => handler.enable());
            window.map.getContainer().style.pointerEvents = 'auto';
        }
        if (selectMunicipio) selectMunicipio.disabled = false;
        isLoading = false;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Carregar lista inicial de municípios
    carregarMunicipios();
    // Listener para mudança no select
    const selectMunicipio = document.getElementById('municipios');
    selectMunicipio.addEventListener('change', async function() {
        if (this.value) {
            const dados = await buscarDadosMunicipio(this.value);
            // Aqui você pode implementar a lógica para atualizar a interface com os dados
        }
    });
});

// Função para atualizar município selecionado (chamada pelo mapa ou select)
function atualizarMunicipioSelecionado(codIbge, origem) {
    console.log(`Município selecionado: ${codIbge} (origem: ${origem})`);
    
    // Atualizar select se a seleção veio do mapa
    if (origem === 'mapa') {
        const select = document.getElementById('municipios');
        select.value = codIbge;
    }
    
    // Buscar dados do município
    buscarDadosMunicipio(codIbge);
}

// Exportar funções para uso global
window.atualizarMunicipioSelecionado = atualizarMunicipioSelecionado;

// Função para extrair o ID da imagem do URL do Google Drive
function getThumbnailUrl(driveUrl) {
    if (!driveUrl) return '';

    const regex = /\/d\/(.*?)(\/|$)/; // Regex para capturar o ID entre /d/ e /view
    const match = driveUrl.match(regex);
    console.log({driveUrl});
    if (match && match[1]) {
        const imageId = match[1]; // Extrai o ID
        return `https://drive.google.com/thumbnail?id=${imageId}`; // Retorna a URL da miniatura
    }
    return ''; // Retorna string vazia se o URL não for válido
}

function createPieChart(containerId) {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'pieChart';
    
    // Get the container and append the canvas
    const container = document.getElementById(containerId);
    container.appendChild(canvas);

    // Generate random data (values between 10 and 100)
    const data = Array.from({length: 4}, () => Math.floor(Math.random() * 90) + 10);

    // Create the chart
    new Chart(canvas, {
        type: 'pie',
        data: {
            labels: ['Baixo (0-33%)', 'Médio (34-66%)', 'Alto (67-100%)', 'Concluído'],
            datasets: [{
                data: data,
                backgroundColor: [
                    '#2E7D32', // Dark green
                    '#4CAF50', // Medium green
                    '#81C784',  // Light green
                    '#12447F'
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    align: 'start',
                    labels: {
                        boxWidth: 20,
                        padding: 10
                    }
                },
                title: {
                    display: true,
                    text: 'Distribuição de pontos'
                }
            }
        }
    });
}