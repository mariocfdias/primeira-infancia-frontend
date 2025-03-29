// Mission Panorama Component
// This file implements the panorama view of missions as shown in the image

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded event fired");
    
    // Verificar se o elemento panorama-missoes existe
    if (document.getElementById('panorama-missoes')) {
        console.log("Panorama de missões encontrado, carregando dados...");
        // Carregar o panorama de missões a partir do arquivo local para testes
        carregarDadosLocais();
    } else {
        console.log("Elemento panorama-missoes não encontrado");
    }
    
    // Carregar e inicializar a seção de eventos
    if (document.getElementById('eventos-section')) {
        console.log("Seção de eventos encontrada, inicializando...");
        inicializarSecaoEventos();
    } else {
        console.log("Elemento eventos-section não encontrado");
    }

    // Fix for municipality images
    fixMunicipalityImages();
    
    // Adicionar botão para limpar filtros do mapa no painel esquerdo
    addClearFiltersButton();
});

// Função para carregar dados locais para testes
async function carregarDadosLocais() {
    const panoramaContainer = document.getElementById('panorama-missoes');
    
    // Mostrar loading
    panoramaContainer.innerHTML = `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
        <div class="skeleton-content">
            <div class="mission-cards-grid">
                ${Array(9).fill().map(() => `
                    <div class="mission-card skeleton">
                        <div class="skeleton-text" style="width: 70%; height: 20px;"></div>
                        <div class="skeleton-text" style="width: 90%; height: 16px;"></div>
                        <div class="skeleton-text" style="width: 40%; height: 16px;"></div>
                        <div class="skeleton-button" style="width: 120px; height: 36px;"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    try {
        // Primeiro tentar carregar da API
        console.log("Tentando carregar dados da API...");
        try {
            const apiUrl = `${window.API_BASE_URL}/dashboard/mission-panorama`;
            console.log("URL da API:", apiUrl);
            
            const apiResponse = await fetch(apiUrl, { timeout: 5000 });
            if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                console.log("Dados carregados da API:", apiData);
                
                if (apiData.status === 'success' && apiData.data) {
                    // Renderizar o panorama de missões com dados da API
                    renderizarPanoramaMissoes(apiData.data);
                    return apiData.data;
                } else {
                    console.warn("Formato de dados inválido da API, tentando arquivo local");
                    throw new Error('Formato de dados inválido da API');
                }
            } else {
                console.warn("Resposta da API não foi bem-sucedida:", apiResponse.status);
                throw new Error(`Erro na resposta da API: ${apiResponse.status}`);
            }
        } catch (apiError) {
            console.warn("Erro ao carregar dados da API:", apiError.message);
            console.log("Tentando carregar do arquivo local como fallback...");
            
            // Se falhar, tentar carregar do arquivo local
            const response = await fetch('mission-panorama-response.json');
            if (!response.ok) {
                throw new Error('Erro ao carregar dados locais');
            }
            
            const data = await response.json();
            console.log("Dados carregados do arquivo local:", data);
            
            if (data.status === 'success' && data.data) {
                // Renderizar o panorama de missões
                renderizarPanoramaMissoes(data.data);
                return data.data;
            } else {
                throw new Error('Formato de dados inválido no arquivo local');
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        panoramaContainer.innerHTML = `
            <div class="erro-carregamento">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Não foi possível carregar o panorama de missões. Tente novamente mais tarde.</p>
                <p class="error-details">${error.message}</p>
            </div>
        `;
    }
}

// Adicionar estado global para missão e filtros
window.missionState = {
    selectedMission: null,
    selectedFilter: 'all', // 'all', 'completed', 'started', 'pending'
    mapFilter: null
};

// Função para atualizar o estado da missão
function updateMissionState(missionId) {
    console.log("Atualizando estado da missão:", missionId);
    
    // Atualizar o estado global
    window.missionState.selectedMission = missionId;
    
    // Destacar a missão selecionada
    highlightSelectedMission(missionId);
    
    // Buscar dados da missão
    fetchMissionData(missionId);
    
    // Atualizar o alerta de missão selecionada
    updateMissionFilterAlert(missionId);
    
    // Atualizar a legenda do mapa
    if (window.mapPanoramaInstance && typeof window.mapPanoramaInstance.updateLegend === 'function') {
        window.mapPanoramaInstance.updateLegend();
    }
    
    // Se um município já estiver selecionado, recarregar suas informações
    // para mostrar o desempenho específico na missão
    const municipioSelect = document.getElementById('municipio-select');
    if (municipioSelect && municipioSelect.value) {
        const selectedMunicipioId = municipioSelect.value;
        console.log("Município já selecionado:", selectedMunicipioId);
        
        // Verificar se existe a instância do MapPanorama
        if (window.mapPanoramaInstance) {
            console.log("Recarregando informações do município com a missão selecionada");
            window.mapPanoramaInstance.loadMunicipioInfo(selectedMunicipioId);
        }
    }
}

// Função para atualizar o alerta de missão selecionada
function updateMissionFilterAlert(missionId) {
    console.log("Atualizando alerta de missão selecionada:", missionId);
    
    const alertContainer = document.getElementById('mission-filter-alert');
    if (!alertContainer) {
        console.warn("Container de alerta não encontrado");
        return;
    }
    
    // Encontrar a missão selecionada
    const selectedMission = findMissionById(missionId);
    
    if (selectedMission) {
        console.log("Missão encontrada:", selectedMission);
        alertContainer.innerHTML = `
            <div class="alert alert-secondary" role="alert">
                <strong>Mostrando resultados para a missão:</strong><br>
                ${selectedMission.descricao_da_missao}
            </div>
        `;
    } else {
        console.warn("Missão não encontrada para o ID:", missionId);
        alertContainer.innerHTML = '';
    }
}

// Função auxiliar para encontrar uma missão pelo ID
function findMissionById(missionId) {
    // Verificar se temos dados de missões carregados
    const panoramaContainer = document.getElementById('panorama-missoes');
    if (!panoramaContainer) return null;
    
    // Tentar encontrar o card da missão
    const missionCard = document.querySelector(`.mission-card[data-mission-id="${missionId}"]`);
    if (!missionCard) return null;
    
    // Extrair a descrição da missão do card
    const missionTitle = missionCard.querySelector('.mission-title p');
    if (!missionTitle) return null;
    
    return {
        id: missionId,
        descricao_da_missao: missionTitle.textContent
    };
}

// Função para destacar a missão selecionada
function highlightSelectedMission(missionId) {
    console.log("Destacando missão:", missionId);
    
    // Resetar todos os cards
    document.querySelectorAll('.mission-card').forEach(card => {
        card.style.opacity = '0.5';
        card.style.border = 'none';
    });
    
    // Destacar o card selecionado
    const selectedCard = document.querySelector(`.mission-card[data-mission-id="${missionId}"]`);
    if (selectedCard) {
        console.log("Card encontrado, aplicando destaque");
        selectedCard.style.opacity = '1';
        selectedCard.style.border = '2px solid #FFD700'; // Borda dourada
    } else {
        console.warn("Card não encontrado para o ID:", missionId);
    }
}

// Função para buscar dados da missão
async function fetchMissionData(missionId) {
    console.log("Buscando dados da missão:", missionId);
    
    try {
        // Usar a URL base global
        let url = `${window.API_BASE_URL}/dashboard/mission-panorama/${missionId}`;
        
        console.log("Usando URL da API:", url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao carregar dados da missão: ${response.status}`);
        }

        console.log({response});
        
        // Usar diretamente response.json() para processar a resposta
        const data = await response.json();
        console.log("Dados da missão recebidos:", data);
        console.log({data});
        
        if (data.status === 'success') {
            updateMapColors(data.data);
        } else {
            console.error("Resposta da API com status diferente de success:", data);
            
            // Fallback: se a API falhar, tentar carregar do arquivo local
            console.log("Tentando carregar do arquivo local como fallback");
            await fetchMissionDataFromFile(missionId);
        }
    } catch (error) {
        console.error('Erro ao buscar dados da missão da API:', error);
        
        // Fallback: se a API falhar, tentar carregar do arquivo local
        console.log("Tentando carregar do arquivo local como fallback");
        await fetchMissionDataFromFile(missionId);
    }
}

// Função para buscar dados da missão de um arquivo local (fallback)
async function fetchMissionDataFromFile(missionId) {
    try {
        const response = await fetch('mission-panorama-by-id-response.json');
        if (!response.ok) {
            throw new Error(`Erro ao carregar arquivo local: ${response.status}`);
        }
        
        const responseText = await response.text();
        
        if (!responseText || responseText.trim() === '') {
            throw new Error("Arquivo local vazio");
        }
        
        try {
            const data = JSON.parse(responseText);
            console.log("Dados carregados do arquivo local:", data);
            
            if (data.status === 'success') {
                updateMapColors(data.data);
            } else {
                console.error("Formato de dados inválido no arquivo local");
            }
        } catch (jsonError) {
            console.error("Erro ao analisar JSON do arquivo local:", jsonError);
            throw new Error("Erro ao analisar JSON do arquivo local");
        }
    } catch (error) {
        console.error('Erro ao carregar dados do arquivo local:', error);
    }
}

// Função para atualizar cores do mapa
function updateMapColors(missionData) {
    console.log("Atualizando cores do mapa com dados:", missionData);
    
    if (!window.geoJSONLayer) {
        console.error('Camada GeoJSON não inicializada');
        return;
    }
    
    // Criar conjuntos para busca rápida
    const completedMunicipios = new Set(missionData.completedMunicipios.map(m => m.codIbge));
    const startedMunicipios = new Set(missionData.startedMunicipios.map(m => m.codIbge));
    const pendingMunicipios = new Set(missionData.pendingMunicipios.map(m => m.codIbge));
    
    console.log("Municípios completados:", completedMunicipios.size);
    console.log("Municípios iniciados:", startedMunicipios.size);
    console.log("Municípios pendentes:", pendingMunicipios.size);
    
    // Obter o conjunto global de municípios participantes (se disponível)
    const participatingMunicipios = window.participatingMunicipalities || new Set();
    console.log("Total de municípios participantes:", participatingMunicipios.size);
    
    // Obter o mapa de cores para missões
    const missionColorMap = {
        'NP': '#FFFFFF',  // Não participante (não aderiu)
        'NA': '#FFFFFF',  // Legado: não aderiu
        0: '#9F9F9F',    // Não iniciado (pendente)
        1: '#72C576',    // Em ação (started)
        2: '#12447F'     // Concluído (completed)
    };
    
    // Contador para armazenar quantos municípios estão em cada nível
    const countByLevel = {0: 0, 1: 0, 2: 0, 'NP': 0, 'NA': 0};
    
    // Atualizar cada camada no mapa
    window.geoJSONLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            const codIbge = layer.feature.properties.id;
            const stringCodIbge = codIbge.toString();
            
            // Verificar se o município participa do programa
            const isParticipating = participatingMunicipios.has(parseInt(codIbge)) || 
                                  participatingMunicipios.has(stringCodIbge);
                                  
            if (!isParticipating) {
                // Município não aderiu ao Pacto
                countByLevel['NP']++;
                const color = missionColorMap['NP'] || '#FFFFFF';
                
                // Usar a função global para atualizar a cor
                if (window.updateLayerColor) {
                    window.updateLayerColor(layer, color);
                } else {
                    console.warn("Função updateLayerColor não encontrada, usando fallback");
                    layer.setStyle({ fillColor: color });
                }
            } 
            else {
                // Município participa do programa, verificar estado da missão
                let level = 0; // Padrão: pendente (0)
                
                if (completedMunicipios.has(codIbge) || completedMunicipios.has(stringCodIbge)) {
                    level = 2; // Concluído
                } else if (startedMunicipios.has(codIbge) || startedMunicipios.has(stringCodIbge)) {
                    level = 1; // Em ação
                } else if (pendingMunicipios.has(codIbge) || pendingMunicipios.has(stringCodIbge)) {
                    level = 0; // Pendente
                }
                
                // Incrementar contador para este nível
                countByLevel[level]++;
                
                const color = missionColorMap[level] || missionColorMap[0];
                
                // Usar a função global para atualizar a cor
                if (window.updateLayerColor) {
                    window.updateLayerColor(layer, color);
                } else {
                    console.warn("Função updateLayerColor não encontrada, usando fallback");
                    layer.setStyle({ fillColor: color });
                }
            }
        }
    });
    
    // Para compatibilidade, manter 'NA' igual a 'NP'
    countByLevel['NA'] = countByLevel['NP'];
    
    console.log("Contagem de municípios por nível:", countByLevel);
    
    // Armazenar o contador na instância do MapPanorama para uso na legenda
    if (window.mapPanoramaInstance) {
        window.mapPanoramaInstance.countByLevel = countByLevel;
        
        // Atualizar a legenda para mostrar as contagens
        if (typeof window.mapPanoramaInstance.updateLegend === 'function') {
            window.mapPanoramaInstance.updateLegend();
        }
    }
    
    console.log("Cores do mapa atualizadas");
}

// Função para renderizar o panorama de missões
function renderizarPanoramaMissoes(missoes) {
    const panoramaContainer = document.getElementById('panorama-missoes');
    
    // Header do panorama sem o botão de limpar filtros (removido)
    const headerHTML = `
        <div class="panorama-header">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2>Panorama de missões</h2>
            </div>
            <p class="panorama-description">
                Cada card abaixo representa uma missão específica e mostra a quantidade de municípios que já a concluíram. 
                Acesse "<strong>Ver no mapa</strong>" para visualizar no mapa interativo os municípios que completaram, estão em ação ou não iniciaram essa missão.
            </p>
        </div>
    `;
    
    // Grid de cards de missões
    const cardsHTML = `
        <div class="mission-cards-grid">
            ${missoes.map(missaoItem => {
                const { missao, countValid, totalMunicipios } = missaoItem;
                const backgroundColor = getCategoryBackground(missao.categoria);
                const categoryIcon = window.getIconByCategoryId ? window.getIconByCategoryId(missao.categoria) : '<i class="fas fa-star"></i>';
                
                return `
                    <div class="mission-card" style="background: ${backgroundColor};" data-categoria="${missao.categoria}" data-mission-id="${missao.id}">
                        <div class="category-pill" style="background: ${backgroundColor};">
                            <span class="category-icon">${categoryIcon}</span>
                            <span class="category-text">${missao.descricao_da_categoria}</span>
                        </div>
                        <div class="mission-title">
                            <p>${missao.descricao_da_missao}</p>
                        </div>
                        <div class="mission-stats">
                            <div class="progress" style="position: relative; height: 15px; width: 100%;">
                                <div class="progress-bar"
                                     role="progressbar" 
                                     style="width: ${Math.round((countValid / totalMunicipios) * 100)}%; background: linear-gradient(to right, #FFDD9A, #FCBA38);" 
                                     aria-valuenow="${countValid}" 
                                     aria-valuemin="0" 
                                     aria-valuemax="${totalMunicipios}">
                                </div>
                            </div>
                            <div class="points-chip" style="font-weight: bold; font-size: 16px; display: flex; align-items: center; gap: 4px;">
                                <span>${countValid}/${totalMunicipios}</span>
                            </div>
                        </div>
                        <a href="#" class="view-map-button" data-mission-id="${missao.id}">
                            Ver no mapa <i class="fas fa-map-marker-alt"></i>
                        </a>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Combinar o HTML e atualizar o container
    panoramaContainer.innerHTML = headerHTML + cardsHTML;
    
    // Adicionar event listeners aos botões "Ver no mapa"
    document.querySelectorAll('.view-map-button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Botão Ver no mapa clicado");
            
            const missionId = this.getAttribute('data-mission-id');
            console.log("ID da missão:", missionId);
            
            // Atualizar o estado da missão
            updateMissionState(missionId);
            
            // Scroll para o mapa
            const mapElement = document.querySelector('.map-container');
            if (mapElement) {
                mapElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// Função para obter a cor de fundo com base na categoria
function getCategoryBackground(categoryId) {
    const backgroundMap = {
        'CTG1': 'linear-gradient(to right, #3D5E85, #5E7DA0)',
        'CTG2': 'linear-gradient(to right, #256F93, #5B97B5)',
        'CTG3': 'linear-gradient(to right, #1C434F, #0A5166)'
    };
    
    return backgroundMap[categoryId] || backgroundMap['CTG1']; // Retorna o gradiente padrão se a categoria não existir
}

// SEÇÃO DE EVENTOS

// Configurações para a seção de eventos
const eventosConfig = {
    apiUrl: 'http://localhost:3000/api/eventos',
    pagina: 0,
    limite: 10,
    tipoEvento: null, // valores possíveis: mission_completed, mission_started, null para todos
    municipioFiltro: '',
    ordenacao: 'DESC'
};

// Função para inicializar a seção de eventos
function inicializarSecaoEventos() {
    console.log("Inicializando seção de eventos");
    // Carregar dados iniciais
    carregarEventos();
    
    // Inicializar event listeners
    inicializarEventListenersEventos();
}

// Inicializar event listeners para a seção de eventos
function inicializarEventListenersEventos() {
    console.log("Adicionando event listeners para filtros de eventos");
    
    // Verificar se existe o radio button para "Todos os eventos"
    const todosEventosRadio = document.getElementById('todos-eventos');
    const missionCompletedRadio = document.getElementById('mission-completed');
    const missionStartedRadio = document.getElementById('mission-started');
    
    // Se o radio de "todos-eventos" existe, adicionar listener
    if (todosEventosRadio) {
        todosEventosRadio.addEventListener('change', function() {
            console.log("Filtro todos os eventos alterado:", this.checked);
            if (this.checked) {
                eventosConfig.tipoEvento = null;
                eventosConfig.pagina = 0;
                carregarEventos();
            }
        });
    } else {
        console.log("Radio 'todos-eventos' não encontrado, verificando outros radiobuttons");
    }
    
    // Adicionar listeners para os tipos específicos
    if (missionCompletedRadio) {
        missionCompletedRadio.addEventListener('change', function() {
            console.log("Filtro mission_completed alterado:", this.checked);
            if (this.checked) {
                eventosConfig.tipoEvento = 'mission_completed';
                eventosConfig.pagina = 0;
                carregarEventos();
            }
        });
    } else {
        console.warn("Elemento 'mission-completed' não encontrado");
    }
    
    if (missionStartedRadio) {
        missionStartedRadio.addEventListener('change', function() {
            console.log("Filtro mission_started alterado:", this.checked);
            if (this.checked) {
                eventosConfig.tipoEvento = 'mission_started';
                eventosConfig.pagina = 0;
                carregarEventos();
            }
        });
    } else {
        console.warn("Elemento 'mission-started' não encontrado");
    }
    
    // Event listener para o filtro de município
    const municipioInput = document.getElementById('municipio-search');
    
    if (municipioInput) {
        // Usar debounce para evitar muitas requisições
        let debounceTimeout;
        municipioInput.addEventListener('input', function() {
            console.log("Input de município alterado:", this.value);
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                eventosConfig.municipioFiltro = this.value;
                eventosConfig.pagina = 0;
                carregarEventos();
            }, 300);
        });
    } else {
        console.error("Elemento 'municipio-search' não encontrado");
    }
    
    // Event listener para a ordenação
    const orderSelect = document.getElementById('order-select');
    
    if (orderSelect) {
        orderSelect.addEventListener('change', function() {
            console.log("Ordenação alterada:", this.value);
            eventosConfig.ordenacao = this.value;
            eventosConfig.pagina = 0;
            carregarEventos();
        });
    } else {
        console.error("Elemento 'order-select' não encontrado");
    }
}

// Função para carregar eventos
async function carregarEventos() {
    console.log("Carregando eventos com configuração:", eventosConfig);
    
    const eventosContainer = document.getElementById('eventos-content');
    if (!eventosContainer) {
        console.error("Container de eventos não encontrado");
        return;
    }
    
    // Mostrar loading
    eventosContainer.innerHTML = `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    try {
        // Construir URL da API com parâmetros
        let urlString = `${window.API_BASE_URL}/eventos`;
        urlString += `?page=${eventosConfig.pagina}`;
        urlString += `&limit=${eventosConfig.limite}`;
        
        // Adicionar tipo de evento à URL apenas se um tipo específico for selecionado
        if (eventosConfig.tipoEvento) {
            urlString += `&event=${eventosConfig.tipoEvento}`;
        }
        
        urlString += `&sortDirection=${eventosConfig.ordenacao}`;
        
        if (eventosConfig.municipioFiltro) {
            urlString += `&municipioSearch=${encodeURIComponent(eventosConfig.municipioFiltro)}`;
        }
        
        console.log("URL da API de eventos:", urlString);

        try {
            // Fazer requisição à API
            console.log("Fazendo requisição à API de eventos");
            const response = await fetch(urlString);
            if (!response.ok) {
                console.error("Erro na resposta da API:", response.status);
                throw new Error('Erro ao carregar eventos da API');
            }
            const data = await response.json();
            console.log("Dados recebidos da API:", data);
            
            // Verificar se os dados foram carregados com sucesso
            if (data && data.status === 'success' && data.data) {
                console.log("Renderizando eventos com dados da API");
                renderizarEventos(data.data, data.pagination);
            } else {
                throw new Error('Formato de dados inválido da API');
            }
        } catch (apiError) {
            console.error('Erro ao carregar dados da API, tentando arquivo local:', apiError);
            
            // Tentar carregar do arquivo local
            try {
                console.log("Tentando carregar dados do arquivo local event-response.json");
                const response = await fetch('event-response.json');
                if (!response.ok) {
                    console.warn("Arquivo event-response.json não encontrado ou erro na resposta:", response.status);
                    throw new Error('Arquivo não encontrado');
                }
                const data = await response.json();
                console.log("Dados carregados do arquivo local:", data);
                
                // Verificar se os dados foram carregados com sucesso
                if (data && data.status === 'success' && data.data) {
                    // Filtrar os eventos localmente se um tipo específico foi selecionado
                    let eventosData = data.data;
                    if (eventosConfig.tipoEvento) {
                        eventosData = eventosData.filter(evento => evento.event === eventosConfig.tipoEvento);
                        // Atualizar paginação com base nos eventos filtrados
                        const totalEventosFiltrados = eventosData.length;
                        const paginacao = {
                            ...data.pagination,
                            total: totalEventosFiltrados,
                            pages: Math.ceil(totalEventosFiltrados / eventosConfig.limite)
                        };
                        console.log("Renderizando eventos filtrados localmente:", eventosData.length);
                        renderizarEventos(eventosData, paginacao);
                    } else {
                        console.log("Renderizando todos os eventos do arquivo local");
                        renderizarEventos(data.data, data.pagination);
                    }
                } else {
                    throw new Error('Formato de dados inválido no arquivo local');
                }
            } catch (localError) {
                // Se não encontrar o arquivo ou houver erro, usar dados de exemplo
                console.log('Erro ao carregar arquivo local:', localError.message);
                console.log('Usando dados de exemplo para eventos');
                const data = gerarDadosExemploEventos();
                console.log("Dados de exemplo gerados:", data);
                
                // Filtrar os dados de exemplo se um tipo foi selecionado
                let eventosData = data.data;
                if (eventosConfig.tipoEvento) {
                    eventosData = eventosData.filter(evento => evento.event === eventosConfig.tipoEvento);
                    // Atualizar paginação
                    const totalEventosFiltrados = eventosData.length;
                    const paginacao = {
                        ...data.pagination,
                        total: totalEventosFiltrados,
                        pages: Math.ceil(totalEventosFiltrados / eventosConfig.limite)
                    };
                    renderizarEventos(eventosData, paginacao);
                } else {
                    renderizarEventos(data.data, data.pagination);
                }
            }
        }
    } catch (error) {
        console.error('Erro geral ao carregar eventos:', error);
        eventosContainer.innerHTML = `
            <div class="erro-carregamento">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Não foi possível carregar os eventos. Tente novamente mais tarde.</p>
                <p class="error-details">${error.message}</p>
            </div>
        `;
    }
}

// Função para gerar dados de exemplo para eventos
function gerarDadosExemploEventos() {
    const hoje = new Date();
    
    // Gerar eventos de exemplo
    const eventos = [
        {
            id: 1,
            data_alteracao: hoje.toISOString(),
            event: 'mission_completed',
            cod_ibge: '2302305',
            municipio: {
                codIbge: '2302305',
                nome: 'Canindé',
                status: 'Participante',
                badges: 1,
                points: 20,
                imagemAvatar: null
            },
            missao: {
                id: 1,
                descricao_da_missao: 'Priorizar a primeira infância na gestão de políticas e na alocação de recursos'
            },
            emblema: 'Fortalecimento da Governança'
        },
        {
            id: 2,
            data_alteracao: new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            event: 'mission_completed',
            cod_ibge: '2305800',
            municipio: {
                codIbge: '2305800',
                nome: 'Ererê',
                status: 'Participante',
                badges: 1,
                points: 20,
                imagemAvatar: null
            },
            missao: {
                id: 1,
                descricao_da_missao: 'Priorizar a primeira infância na gestão de políticas e na alocação de recursos'
            },
            emblema: 'Fortalecimento da Governança'
        },
        {
            id: 3,
            data_alteracao: new Date(hoje.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            event: 'mission_started',
            cod_ibge: '2308401',
            municipio: {
                codIbge: '2308401',
                nome: 'Milagres',
                status: 'Participante',
                badges: 0,
                points: 0,
                imagemAvatar: null
            },
            missao: {
                id: 2,
                descricao_da_missao: 'Capacitar os profissionais da primeira infância'
            },
            emblema: ''
        },
        {
            id: 4,
            data_alteracao: new Date(hoje.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            event: 'participante_evento',
            cod_ibge: '2304400',
            municipio: {
                codIbge: '2304400',
                nome: 'Fortaleza',
                status: 'Participante',
                badges: 0,
                points: 5,
                imagemAvatar: null
            },
            missao: null,
            emblema: ''
        }
    ];
    
    return {
        status: 'success',
        data: eventos,
        pagination: {
            total: 41,
            page: eventosConfig.pagina,
            limit: eventosConfig.limite,
            pages: 5
        }
    };
}

// Função para renderizar os eventos
function renderizarEventos(eventos, paginacao) {
    console.log("Renderizando eventos:", eventos);
    console.log("Paginação:", paginacao);
    
    const eventosContainer = document.getElementById('eventos-content');
    
    if (!eventosContainer) {
        console.error("Elemento 'eventos-content' não encontrado na renderização");
        return;
    }
    
    // Se não há eventos
    if (!eventos || eventos.length === 0) {
        console.log("Nenhum evento encontrado para renderizar");
        eventosContainer.innerHTML = `
            <div class="sem-eventos">
                <i class="fas fa-info-circle"></i>
                <p>Nenhum evento encontrado para os filtros selecionados.</p>
            </div>
        `;
        return;
    }
    
    // Renderizar lista de eventos
    console.log(`Construindo HTML para ${eventos.length} eventos`);
    const eventosHTML = eventos.map((evento, index) => {
        // Determinar o tipo de evento e texto
        const eventoType = evento.event;
        let eventoText = '';
        let pointsText = '';
        let emblemaText = evento.emblema || '';
        
        console.log(`Processando evento ${index+1}:`, eventoType, evento);
        
        // Tratar diferentes tipos de eventos
        if (eventoType === 'mission_completed') {
            let missaoDesc = "Priorizar a primeira infância na gestão de políticas e na alocação de recursos";
            if (evento.missao && evento.missao.descricao_da_missao) {
                missaoDesc = evento.missao.descricao_da_missao;
            }
            
            eventoText = `concluiu a missão "${missaoDesc}" e ganhou`;
            pointsText = '20 pontos';
        } else if (eventoType === 'mission_started') {
            let missaoDesc = "Capacitar os profissionais da primeira infância";
            if (evento.missao && evento.missao.descricao_da_missao) {
                missaoDesc = evento.missao.descricao_da_missao;
            }
            
            eventoText = `iniciou a missão "${missaoDesc}"`;
            pointsText = '';
        } else if (eventoType === 'participante_evento') {
            eventoText = 'participou de um evento do Pacto Cearense da Primeira Infância';
            pointsText = evento.municipio?.points ? `${evento.municipio.points} pontos` : '';
        } else {
            // Tipo de evento não reconhecido - usar valor padrão
            console.warn(`Tipo de evento não reconhecido: ${eventoType}`);
            eventoText = 'participou de uma atividade no Pacto Cearense da Primeira Infância';
            pointsText = '';
        }
        
        // Formatação da data
        let dataFormatada = 'Data desconhecida';
        if (evento.data_alteracao) {
            try {
                // Configurar o locale para pt-br
                moment.locale('pt-br');
                
                // Usar o formato calendar do Moment.js que já trata relativamente (hoje, ontem, etc)
                dataFormatada = moment(evento.data_alteracao).calendar(null, {
                    sameDay: '[Hoje]',
                    lastDay: '[Ontem]',
                    lastWeek: function() {
                        return '[' + this.fromNow(true) + ']';
                    },
                    sameElse: 'L' // Formato padrão para datas mais antigas (DD/MM/YYYY)
                });
            } catch (e) {
                console.error("Erro ao formatar data com Moment.js:", e, evento.data_alteracao);
            }
        }
        
        // Iniciais do município para avatar
        const municipioNome = evento.municipio?.nome || "Município";
        const iniciais = municipioNome.split(' ').map(palavra => palavra[0]).join('').substring(0, 2).toUpperCase();
        
        // Avatar do município (usar imagem se disponível, ou iniciais)
        const avatarHTML = evento.municipio?.imagemAvatar 
            ? `<img src="${evento.municipio.imagemAvatar}" alt="${municipioNome}">`
            : iniciais;
        
        // Construir card do evento
        return `
            <div class="evento-card">
                <div class="evento-municipio-avatar">
                    ${avatarHTML}
                </div>
                <div class="evento-card-content">
                    <div class="evento-municipio-title">
                        Prefeitura de ${municipioNome}
                    </div>
                    <div class="evento-missao-text">
                        ${eventoText}
                        ${pointsText ? `<span class="evento-points-badge">${pointsText} <i class="fas fa-star"></i></span>` : ''}
                    </div>
                    ${emblemaText ? `
                        <div class="evento-emblema">
                            e um emblema de <strong>${emblemaText}</strong>.
                        </div>
                    ` : ''}
                </div>
                <div class="evento-card-date">
                    ${dataFormatada}
                </div>
            </div>
        `;
    }).join('');
    
    console.log("Atualizando container de eventos com HTML");
    eventosContainer.innerHTML = eventosHTML;
    
    // Atualizar a paginação
    console.log("Atualizando paginação");
    atualizarPaginacao(paginacao);
}

// Função para atualizar a paginação
function atualizarPaginacao(paginacao) {
    console.log("Atualizando paginação com dados:", paginacao);
    
    if (!paginacao) {
        console.warn("Dados de paginação não fornecidos");
        return;
    }
    
    const { total, page, limit, pages } = paginacao;
    const paginacaoElement = document.querySelector('.eventos-pagination ul');
    
    if (!paginacaoElement) {
        console.error("Elemento de paginação não encontrado");
        return;
    }
    
    // Se não há elementos suficientes para paginar
    if (total <= limit) {
        console.log("Poucos itens para paginar, ocultando paginação");
        paginacaoElement.innerHTML = '';
        return;
    }
    
    // Botão anterior
    let paginacaoHTML = `
        <li class="page-item ${page === 0 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${page - 1}" aria-label="Anterior">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    // Determinar quais páginas mostrar
    let paginasParaMostrar = [];
    const paginasVisiveis = 5; // Número máximo de páginas a mostrar
    
    if (pages <= paginasVisiveis) {
        // Mostrar todas as páginas se couberem
        paginasParaMostrar = Array.from({ length: pages }, (_, i) => i);
    } else if (page < Math.floor(paginasVisiveis / 2)) {
        // Primeiras páginas
        paginasParaMostrar = Array.from({ length: paginasVisiveis }, (_, i) => i);
    } else if (page >= pages - Math.floor(paginasVisiveis / 2)) {
        // Últimas páginas
        paginasParaMostrar = Array.from({ length: paginasVisiveis }, (_, i) => pages - paginasVisiveis + i);
    } else {
        // Páginas do meio
        paginasParaMostrar = Array.from(
            { length: paginasVisiveis }, 
            (_, i) => page - Math.floor(paginasVisiveis / 2) + i
        );
    }
    
    // Adicionar os números de página
    paginasParaMostrar.forEach(numeroPagina => {
        paginacaoHTML += `
            <li class="page-item ${numeroPagina === page ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${numeroPagina}">${numeroPagina + 1}</a>
            </li>
        `;
    });
    
    // Botão próximo
    paginacaoHTML += `
        <li class="page-item ${page >= pages - 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${page + 1}" aria-label="Próximo">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
    
    // Atualizar a paginação
    paginacaoElement.innerHTML = paginacaoHTML;
    
    // Adicionar event listeners aos links de paginação
    document.querySelectorAll('.eventos-pagination .page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const pagina = parseInt(this.getAttribute('data-page'));
            if (pagina >= 0 && pagina < pages) {
                eventosConfig.pagina = pagina;
                carregarEventos();
                
                // Scroll para o topo da seção de eventos
                document.getElementById('eventos-section').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// Função para limpar filtros do mapa
function limparFiltrosMapa() {
    console.log("Limpando filtros do mapa");
    
    // Resetar o estado global
    window.missionState.selectedMission = null;
    window.missionState.selectedFilter = 'all';
    window.missionState.mapFilter = null;
    
    // Resetar destaque dos cards
    document.querySelectorAll('.mission-card').forEach(card => {
        card.style.opacity = '1';
        card.style.border = 'none';
    });
    
    // Limpar o alerta de missão selecionada
    const alertContainer = document.getElementById('mission-filter-alert');
    if (alertContainer) {
        alertContainer.innerHTML = '';
    }
    
    // Função auxiliar para carregar dados diretamente
    const loadMapPanoramaDataDirectly = async () => {
        try {
            console.log("Carregando dados do mapa diretamente da API...");
            const url = `${window.API_BASE_URL}/dashboard/map-panorama`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erro na resposta: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Dados de panorama carregados diretamente:", data);
            
            if (data && data.municipios) {
                // Processar os dados dos municípios
                const participatingMunicipalities = new Set();
                const municipioLevels = new Map();
                
                data.municipios.forEach(municipio => {
                    const codIbge = municipio.codIbge.toString();
                    
                    if (municipio.desempenho) {
                        const level = municipio.desempenho.level;
                        municipioLevels.set(codIbge, level);
                        
                        if (level !== 'NP') {
                            participatingMunicipalities.add(codIbge);
                        }
                    }
                });
                
                // Atualizar variáveis globais
                window.participatingMunicipalities = participatingMunicipalities;
                
                if (window.mapPanoramaInstance) {
                    window.mapPanoramaInstance.municipioLevels = municipioLevels;
                    window.mapPanoramaInstance.updateMapColors();
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error("Erro ao carregar dados diretamente:", error);
            return false;
        }
    };
    
    // Aplicar coloração básica do mapa
    if (window.geoJSONLayer) {
        // Verificar se existe uma instância de MapPanorama
        if (window.mapPanoramaInstance) {
            console.log("Usando MapPanorama para atualizar as cores do mapa");
            
            // Forçar uma nova busca de dados para garantir o estado padrão
            if (typeof window.mapPanoramaInstance.fetchMapPanoramaData === 'function') {
                console.log("Recarregando dados de panorama do mapa...");
                
                try {
                    // Primeiro, garantir que a instância tenha o estado limpo
                    if (window.mapPanoramaInstance.countByLevel) {
                        // Zerar contadores temporariamente para evitar que a legenda mostre valores antigos
                        const defaultCount = {0: 0, 1: 0, 2: 0, 3: 0, 'NP': 0};
                        window.mapPanoramaInstance.countByLevel = defaultCount;
                        window.mapPanoramaInstance.updateLegend();
                    }
                    
                    // Buscar novos dados da API
                    window.mapPanoramaInstance.fetchMapPanoramaData()
                        .then(() => {
                            console.log("Dados de panorama do mapa recarregados com sucesso");
                            // Garantir que as cores do mapa sejam atualizadas após carregar os dados
                            setTimeout(() => {
                                window.mapPanoramaInstance.updateMapColors();
                                console.log("Cores do mapa atualizadas após recarregar dados");
                            }, 100);
                        })
                        .catch(error => {
                            console.error("Erro ao recarregar dados de panorama:", error);
                            // Fallback: tentar carregar diretamente da API
                            loadMapPanoramaDataDirectly().then(success => {
                                if (!success) {
                                    // Se ainda falhar, atualizar com os dados atuais
                                    window.mapPanoramaInstance.updateMapColors();
                                }
                            });
                        });
                } catch (error) {
                    console.error("Erro ao limpar filtros do mapa:", error);
                    // Fallback: tentar carregar diretamente da API
                    loadMapPanoramaDataDirectly().then(success => {
                        if (!success) {
                            // Se ainda falhar, atualizar com os dados atuais
                            window.mapPanoramaInstance.updateMapColors();
                        }
                    });
                }
            } else {
                console.log("Método fetchMapPanoramaData não encontrado, tentando carregar diretamente");
                
                // Tentar carregar diretamente da API
                loadMapPanoramaDataDirectly().then(success => {
                    if (!success) {
                        // Fallback: usar a distribuição de níveis atual
                        if (window.mapPanoramaInstance.levelDistribution) {
                            const countByLevel = {0: 0, 1: 0, 2: 0, 3: 0, 'NP': 0};
                            
                            // Contar municípios de cada nível
                            for (const level of window.mapPanoramaInstance.levelDistribution) {
                                if (level && level.municipios) {
                                    countByLevel[level.level] = level.municipios.length;
                                }
                            }
                            
                            // Calcular municípios que não aderiram ao pacto
                            const totalMunicipios = window.geoJSONLayer._layers ? Object.keys(window.geoJSONLayer._layers).length : 0;
                            const participatingCount = window.participatingMunicipalities ? window.participatingMunicipalities.size : 0;
                            countByLevel['NP'] = totalMunicipios - participatingCount;
                            
                            // Atualizar contador na instância
                            window.mapPanoramaInstance.countByLevel = countByLevel;
                            console.log("Contador atualizado:", countByLevel);
                        }
                        
                        // Deixar o MapPanorama atualizar as cores com base nos níveis
                        window.mapPanoramaInstance.updateMapColors();
                    }
                });
            }
        } else {
            console.log("Instância de MapPanorama não encontrada, tentando carregar dados diretamente");
            
            // Tentar carregar diretamente da API mesmo sem instância de MapPanorama
            loadMapPanoramaDataDirectly().then(success => {
                if (!success) {
                    // Fallback: aplicar cores manualmente
                    window.geoJSONLayer.eachLayer(layer => {
                        if (layer.feature && layer.feature.properties) {
                            // Obter o nível do município (se disponível)
                            let level = 0;
                            const id = layer.feature.properties.id;
                            
                            // Tentar obter informações de participação global
                            const isParticipating = window.participatingMunicipalities && 
                                                  (window.participatingMunicipalities.has(id) || 
                                                   window.participatingMunicipalities.has(id.toString()));
                            
                            // Escolher a cor adequada
                            let color = isParticipating ? '#50B755' : '#FFFFFF'; // verde para participantes, branco para não participantes
                            
                            // Usar a função global para atualizar a cor
                            if (window.updateLayerColor) {
                                window.updateLayerColor(layer, color);
                            } else {
                                console.warn("Função updateLayerColor não encontrada, usando fallback");
                                layer.setStyle({ fillColor: color });
                            }
                        }
                    });
                }
                
                // Tentar atualizar a legenda mesmo sem o MapPanorama
                const legendElement = document.querySelector('.map-legend-control');
                if (legendElement) {
                    const items = legendElement.querySelectorAll('.legend-number');
                    if (items && items.length > 0) {
                        // Resetar todos os números para 0
                        items.forEach(item => {
                            item.textContent = '0';
                        });
                    }
                }
            });
        }
    } else {
        console.warn("Camada GeoJSON não inicializada");
    }
    
    // Recarregar informações do município selecionado (se houver)
    const municipioSelect = document.getElementById('municipio-select');
    if (municipioSelect && municipioSelect.value && window.mapPanoramaInstance) {
        setTimeout(() => {
            window.mapPanoramaInstance.loadMunicipioInfo(municipioSelect.value);
        }, 300);
    }
    
    console.log("Filtros do mapa limpos com sucesso");
}

// Function to fix municipality images that might be stuck
function fixMunicipalityImages() {
    console.log("Checking for municipality images to fix...");
    
    // Find all municipality-image elements that still have the skeleton class
    const skeletonImages = document.querySelectorAll('.municipality-image.skeleton');
    console.log(`Found ${skeletonImages.length} skeleton images to check`);
    
    skeletonImages.forEach((imageContainer, index) => {
        const realImage = imageContainer.querySelector('.municipality-image-real');
        
        if (realImage) {
            // Check if the image is already loaded but skeleton class wasn't removed
            if (realImage.complete && realImage.naturalWidth > 0) {
                console.log(`Image ${index} is already loaded, removing skeleton class`);
                
                // Force remove skeleton class and show the image
                imageContainer.classList.remove('skeleton');
                realImage.style.opacity = '1';
            } else {
                // Check if this is a Google Drive URL that needs fixing
                const currentSrc = realImage.src;
                
                if (currentSrc && currentSrc.includes('drive.google.com')) {
                    // Try to fix the Google Drive URL
                    console.log(`Image ${index} has a Drive URL that needs fixing:`, currentSrc);
                    
                    // Extract ID using two different regex patterns
                    let imageId = null;
                    
                    // Format 1: /d/{id}/ (standard sharing link)
                    const regexPath = /\/d\/(.*?)(\/|$)/;
                    const matchPath = currentSrc.match(regexPath);
                    
                    // Format 2: id={id} (export and view URLs)
                    const regexQuery = /[?&]id=([^&]+)/;
                    const matchQuery = currentSrc.match(regexQuery);
                    
                    if (matchPath && matchPath[1]) {
                        imageId = matchPath[1];
                    } else if (matchQuery && matchQuery[1]) {
                        imageId = matchQuery[1];
                    }
                    
                    if (imageId) {
                        const newSrc = `https://drive.google.com/thumbnail?id=${imageId}`;
                        console.log(`Fixing Drive URL to thumbnail. New URL: ${newSrc}`);
                        realImage.src = newSrc;
                    }
                }
                
                // Reattach onload handler
                realImage.onload = function() {
                    console.log(`Image ${index} loaded via reattached handler:`, this.src);
                    this.parentElement.classList.remove('skeleton');
                    this.style.opacity = '1';
                };
                
                // If image has been loading for too long, try reloading it
                setTimeout(() => {
                    if (imageContainer.classList.contains('skeleton')) {
                        console.log(`Image ${index} still loading after timeout, trying to reload`);
                        const currentSrc = realImage.src;
                        realImage.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
                        setTimeout(() => { realImage.src = currentSrc; }, 50);
                    }
                }, 3000);
            }
        }
    });
    
    // Set up a periodic check for any new skeleton images
    setTimeout(checkForNewSkeletonImages, 3000);
}

// Function to periodically check for new skeleton images that need fixing
function checkForNewSkeletonImages() {
    const skeletonImages = document.querySelectorAll('.municipality-image.skeleton');
    
    if (skeletonImages.length > 0) {
        console.log(`Found ${skeletonImages.length} skeleton images during periodic check`);
        fixMunicipalityImages();
    } else {
        // If no skeleton images found, set up another check in 5 seconds
        // but only continue for a reasonable amount of time (e.g., 30 seconds total)
        if (!window.skeletonCheckCount) {
            window.skeletonCheckCount = 1;
        } else {
            window.skeletonCheckCount++;
        }
        
        if (window.skeletonCheckCount < 6) { // 5 checks * 5 seconds = 25 seconds + initial 3 seconds = ~30 seconds
            setTimeout(checkForNewSkeletonImages, 5000);
        }
    }
}

// Função para adicionar botão de limpar filtros ao painel esquerdo
function addClearFiltersButton() {
    console.log("Adicionando botão de limpar filtros ao painel esquerdo");
    const leftPanel = document.querySelector('.left-panel');
    
    if (leftPanel) {
        // Criar botão de limpar filtros
        const clearButton = document.createElement('button');
        clearButton.id = 'limpar-filtros-mapa';
        clearButton.className = 'btn btn-outline-primary';
        clearButton.style.marginBottom = '15px';
        clearButton.innerHTML = '<i class="fas fa-refresh"></i> Limpar filtros do mapa';
        
        // Adicionar evento ao botão
        clearButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Botão Limpar filtros do mapa clicado");
            limparFiltrosMapa();
        });
        
        // Inserir após o elemento legenda ou antes do mapa
        const legenda = leftPanel.querySelector('.legenda');
        if (legenda) {
            leftPanel.insertBefore(clearButton, legenda);
        } else {
            const mapContainer = leftPanel.querySelector('.map-container');
            if (mapContainer) {
                leftPanel.insertBefore(clearButton, mapContainer);
            } else {
                // Se não encontrar nenhum dos dois, adicionar ao final
                leftPanel.appendChild(clearButton);
            }
        }
        
        console.log("Botão de limpar filtros adicionado ao painel esquerdo");
    } else {
        console.warn("Painel esquerdo não encontrado");
    }
} 