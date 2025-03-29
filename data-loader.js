import { MapPanorama } from './map-panorama.js';

// Adicione no início do arquivo
(function checkDependencies() {
    const dependencies = {
        'MapPanorama': typeof MapPanorama !== 'undefined',
        'L': typeof L !== 'undefined', // Se estiver usando Leaflet
        // Adicione outras dependências aqui
    };

    const missingDependencies = Object.entries(dependencies)
        .filter(([, exists]) => !exists)
        .map(([name]) => name);

    if (missingDependencies.length > 0) {
        console.error('Dependências ausentes:', missingDependencies.join(', '));
        console.error('Certifique-se de incluir todos os arquivos JS necessários na ordem correta.');
    }
})();

// URL base para as requisições - versão mais configurável
const API_CONFIG = {
    local: {
        url: 'http://localhost:3000/api',
        port: 3000 // você pode alterar esta porta se necessário
    },
    production: {
        url: 'https://primeira-infancia-backend.onrender.com/api'
    }
};

// Tornando API_BASE_URL global
window.API_BASE_URL = (() => {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    const environment = isLocalhost ? 'local' : 'production';
    console.log('Ambiente detectado:', environment);
    
    if (environment === 'local') {
        // Você pode sobrescrever a porta usando uma variável de ambiente ou parâmetro de URL
        const customPort = new URLSearchParams(window.location.search).get('apiPort');
        if (customPort) {
            console.log('Usando porta customizada:', customPort);
            return `http://localhost:${customPort}/api`;
        }
    }
    
    const baseUrl = API_CONFIG[environment].url;
    console.log('API Base URL:', baseUrl);
    return baseUrl;
})();

console.log('API Base URL:', window.API_BASE_URL);

// Adicionar no início do arquivo, após as constantes existentes
let mapPanorama = null;
console.log('data-loader.js carregado');

// Função auxiliar para verificar se MapPanorama está disponível
function createMapPanorama() {
    if (typeof MapPanorama === 'undefined') {
        console.error('MapPanorama não está definido. Verifique se map-panorama.js está carregado.');
        return null;
    }
    return new MapPanorama();
}

// Função para medir tempo de resposta
function medirTempoResposta(inicio) {
    const fim = performance.now();
    console.log('Tempo de resposta: ' + (fim - inicio).toFixed(2) + 'ms');
}

// Função para mostrar/esconder loading
function toggleLoading(show) {
    const mapContainer = document.querySelector('.map-container');
    const loadingOverlays = document.querySelectorAll('.loading-overlay:not(.skeleton-content)');
    
    loadingOverlays.forEach(overlay => overlay.remove());
    
    if (show) {
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

// Verificar a função atualizarCorMapa para garantir que não está sobrescrevendo os dados
function atualizarCorMapa(municipios) {
    if (!window.map || !window.geoJSONLayer) {
        console.error('Mapa ou camada GeoJSON não inicializados');
        return;
    }

    console.log("Atualizando cor do mapa com municipios:", municipios.length);
    
    // Preservar Set existente se já tiver sido criado
    if (!window.participatingMunicipalities) {
        window.participatingMunicipalities = new Set(
            municipios.map(m => parseInt(m.codIbge))
        );
    }
    
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
        const response = await fetch(window.API_BASE_URL + '/municipios');
        if (!response.ok) throw new Error('Erro ao carregar municípios');
        const data = await response.json();
        // medirTempoResposta(inicio);
        
        if (data.status === 'success') {
            console.log("Dados recebidos da API:", data.data.length, "municípios");
            
            // Armazenar dados globalmente
            window.municipiosData = data.data;
            
            // Criar Set de municípios participantes
            window.participatingMunicipalities = new Set(
                data.data.filter(m => m.status === 'Participante' && !isNaN(m.codIbge)).map(m => parseInt(m.codIbge))
            );
            
            // Atualizar select
            popularSelectMunicipios(data.data.filter(m => m.status === 'Participante' && !isNaN(m.codIbge)));

            // Carregar dados do panorama
            try {
                const panoramaResponse = await fetch(window.API_BASE_URL + '/dashboard/map-panorama');
                const panoramaData = await panoramaResponse.json();

                if (panoramaData.status === 'success') {
                    mapPanorama = createMapPanorama();
                    if (mapPanorama) {
                        console.log({panoramaData})
                        mapPanorama.initializePanorama(panoramaData.data.desempenho);
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar panorama:', error);
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

// Função para popular select de municípios
function popularSelectMunicipios(municipios) {
    const select = document.getElementById('municipios');
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>Selecione um município</option>';
    
    municipios
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio.codIbge;
            option.textContent = municipio.nome;
            select.appendChild(option);
        });
}

/* 
 * INÍCIO DAS FUNÇÕES DE RENDERIZAÇÃO DO PAINEL DIREITO (COMENTADAS)
 */

/*
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
                    <div class="mission-status-wrapper" style="display: flex; justify-content: flex-end; gap: 12px; align-items: center; width: 100%;">
                        ${isCompleted ? 
                            `<span class="badge rounded-pill bg-success" style="padding: 4px 12px; gap: 4px; display: flex; align-items: center;">
                                <i class="fas fa-check-circle"></i> <span style="margin-left: 4px;">Missão concluída</span>
                            </span>` : ''
                        }
                        <div class="points-chip" style="font-weight: bold; font-size: 16px; display: flex; align-items: center; gap: 8px;">
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
*/

/*
 * FIM DAS FUNÇÕES DE RENDERIZAÇÃO DO PAINEL DIREITO (COMENTADAS)
 */

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

let isLoading = false;

// Função para buscar dados do município selecionado (simplificada, sem renderização)
async function buscarDadosMunicipio(codIbge) {
    if (isLoading) return;
    isLoading = true;

    const inicio = performance.now();
    try {
        const response = await fetch(window.API_BASE_URL + '/municipios/' + codIbge);

        if (!response.ok) throw new Error('Erro ao carregar dados do município');
        
        const responseData = await response.json();
        // medirTempoResposta(inicio);
        
        return responseData;
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        isLoading = false;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Carregar lista inicial de municípios
    // carregarMunicipios();
    // // Listener para mudança no select
    // const selectMunicipio = document.getElementById('municipios');
    // selectMunicipio.addEventListener('change', async function() {
    //     if (this.value) {
    //         const dados = await buscarDadosMunicipio(this.value);
    //         // Aqui você pode implementar a lógica para atualizar a interface com os dados
    //     }
    // });
});

// Função para atualizar município selecionado (chamada pelo mapa ou select)
function atualizarMunicipioSelecionado(codIbge, origem) {
    console.log(`Município selecionado: ${codIbge} (origem: ${origem})`);
    
    // Atualizar select se a seleção veio do mapa
    if (origem === 'mapa') {
        const select = document.getElementById('municipios');
        if (select) select.value = codIbge;
    }
    
    // Buscar dados do município
    buscarDadosMunicipio(codIbge);
}

// Exportar funções para uso global
window.atualizarMunicipioSelecionado = atualizarMunicipioSelecionado;

// Função para carregar o panorama de missões
async function carregarPanoramaMissoes() {
    toggleLoading(true);
    const inicio = performance.now();
    try {
        const response = await fetch(window.API_BASE_URL + '/dashboard/mission-panorama');
        if (!response.ok) throw new Error('Erro ao carregar panorama de missões');
        const data = await response.json();
        // medirTempoResposta(inicio);
        
        if (data.status === 'success') {
            console.log("Dados de panorama de missões recebidos:", data.data.length, "missões");
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

// Função para visualizar missão no mapa
function visualizarMissaoNoMapa(missionId) {
    console.log(`Visualizando missão ${missionId} no mapa`);
    // Implementação futura - mostrar no mapa os municípios que completaram a missão
}

// Exportar funções para uso global
window.carregarPanoramaMissoes = carregarPanoramaMissoes;
window.visualizarMissaoNoMapa = visualizarMissaoNoMapa;

// Exportar apenas funções necessárias
export {
    carregarMunicipios,
    buscarDadosMunicipio,
    atualizarCorMapa
    // showSkeletonLoading, // Comentado - função de renderização do painel direito
    // updateRightMenu // Comentado - função de renderização do painel direito
};

// Adicionar esta função para inicializar o panorama do mapa independentemente
async function initializeMapPanorama() {
    console.log('Inicializando panorama do mapa...');
    
    // Verificar se a camada GeoJSON está inicializada
    if (!window.geoJSONLayer) {
        console.log('Camada GeoJSON ainda não inicializada. Aguardando...');
        
        // Esperar até que a camada GeoJSON esteja disponível (com timeout)
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!window.geoJSONLayer && attempts < maxAttempts) {
            console.log(`Tentativa ${attempts + 1} de ${maxAttempts} para encontrar a camada GeoJSON...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms
            attempts++;
        }
        
        if (!window.geoJSONLayer) {
            console.error('Camada GeoJSON não foi inicializada após várias tentativas.');
            return false;
        }
        
        console.log('Camada GeoJSON encontrada após espera.');
    }
    
    try {
        const panoramaResponse = await fetch(window.API_BASE_URL + '/dashboard/map-panorama');
        if (!panoramaResponse.ok) {
            throw new Error('Erro ao carregar dados do panorama');
        }
        
        const panoramaData = await panoramaResponse.json();
        
        if (panoramaData.status === 'success') {
            mapPanorama = createMapPanorama();
            if (mapPanorama) {
                console.log('Dados do panorama recebidos:', panoramaData.data);
                mapPanorama.initializePanorama(panoramaData.data.desempenho);
                return true;
            }
        } else {
            console.error('Resposta da API com status diferente de success:', panoramaData);
        }
    } catch (error) {
        console.error('Erro ao inicializar panorama do mapa:', error);
        
        // Tentar carregar do arquivo local como fallback
        try {
            console.log('Tentando carregar dados do arquivo local como fallback...');
            const localResponse = await fetch('map-panorama-response.json');
            if (!localResponse.ok) {
                throw new Error('Arquivo local não encontrado');
            }
            
            const localData = await localResponse.json();
            if (localData.status === 'success') {
                mapPanorama = createMapPanorama();
                if (mapPanorama) {
                    console.log('Dados do panorama carregados do arquivo local');
                    mapPanorama.initializePanorama(localData.data.desempenho);
                    return true;
                }
            }
        } catch (localError) {
            console.error('Erro ao carregar dados locais:', localError);
        }
    }
    
    return false;
}

// Exportar a função para uso global
window.initializeMapPanorama = initializeMapPanorama;

// Adicionar ao evento DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar o panorama do mapa
    initializeMapPanorama();
});