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
        // Carregar dados do arquivo local JSON
        const response = await fetch('mission-panorama-response.json');
        if (!response.ok) {
            throw new Error('Erro ao carregar dados locais');
        }
        
        const data = await response.json();
        console.log("Dados carregados:", data);
        
        if (data.status === 'success' && data.data) {
            // Renderizar o panorama de missões
            renderizarPanoramaMissoes(data.data);
            return data.data;
        } else {
            throw new Error('Formato de dados inválido');
        }
    } catch (error) {
        console.error('Erro ao carregar dados locais:', error);
        panoramaContainer.innerHTML = `
            <div class="erro-carregamento">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Não foi possível carregar o panorama de missões. Tente novamente mais tarde.</p>
                <p class="error-details">${error.message}</p>
            </div>
        `;
    }
}

// Função para renderizar o panorama de missões
function renderizarPanoramaMissoes(missoes) {
    const panoramaContainer = document.getElementById('panorama-missoes');
    
    // Header do panorama
    const headerHTML = `
        <div class="panorama-header">
            <h2>Panorama de missões</h2>
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
                    <div class="mission-card" style="background: ${backgroundColor};" data-categoria="${missao.categoria}">
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
                                     style="width: ${Math.round((countValid / totalMunicipios) * 100)}%; background: linear-gradient(to right, #50B755, #066829);" 
                                     aria-valuenow="${countValid}" 
                                     aria-valuemin="0" 
                                     aria-valuemax="${totalMunicipios}">
                                </div>
                                <span class="position-absolute" style="right: calc(100% - ${Math.round((countValid / totalMunicipios) * 100)}%); transform: translateX(50%); z-index: 10;">
                                    <i class="fas fa-star" style="color: #E79D0D; font-size: 18px;"></i>
                                </span>
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
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const missionId = button.getAttribute('data-mission-id');
            // Verificar se a função de visualização existe
            if (typeof window.visualizarMissaoNoMapa === 'function') {
                window.visualizarMissaoNoMapa(missionId);
            } else {
                // Fallback: redirecionar para a página do mapa com o ID da missão como parâmetro
                const missionParam = new URLSearchParams(window.location.search).get('mission');
                if (!missionParam) {
                    // Só atualiza a URL se já não estiver visualizando uma missão
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.set('mission', missionId);
                    window.history.pushState({}, '', currentUrl);
                    
                    // Scroll para o mapa
                    const mapElement = document.querySelector('.map-container');
                    if (mapElement) {
                        mapElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }
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

// Função para carregar os eventos da API
async function carregarEventos() {
    console.log("Carregando eventos com configuração:", eventosConfig);
    const eventosContainer = document.getElementById('eventos-content');
    
    if (!eventosContainer) {
        console.error("Elemento 'eventos-content' não encontrado");
        return;
    }
    
    // Mostrar loading
    eventosContainer.innerHTML = `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    try {
        // Em ambiente local, sempre usar dados de exemplo para evitar problemas com bloqueadores
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
            console.log("Ambiente local detectado, usando dados locais sem tentar API");
            
            // Primeiro tentar carregar do arquivo local
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
                    return;
                } else {
                    throw new Error('Formato de dados inválido no arquivo local');
                }
            } catch (error) {
                // Se não encontrar o arquivo ou houver erro, usar dados de exemplo
                console.log('Erro ao carregar arquivo local:', error.message);
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
                return;
            }
        }
        
        // Se não estivermos em ambiente local, tentar API
        // Construir URL da API com parâmetros - usar string para evitar erros de URL
        let urlString = eventosConfig.apiUrl;
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
        } catch (error) {
            console.error('Erro ao carregar dados da API, usando dados de exemplo:', error);
            const data = gerarDadosExemploEventos();
            
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
                const dataEvento = new Date(evento.data_alteracao);
                const hoje = new Date();
                const diaEmMilissegundos = 24 * 60 * 60 * 1000;
                
                if (dataEvento.toDateString() === hoje.toDateString()) {
                    dataFormatada = 'Hoje';
                } else if ((hoje - dataEvento) < 7 * diaEmMilissegundos) {
                    dataFormatada = `${Math.floor((hoje - dataEvento) / diaEmMilissegundos)} dias`;
                } else {
                    dataFormatada = dataEvento.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }).replace(/\//g, '/');
                }
            } catch (e) {
                console.error("Erro ao formatar data:", e, evento.data_alteracao);
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