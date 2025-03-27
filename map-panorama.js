// Definir a função global updateLayerColor se ainda não estiver definida
window.updateLayerColor = window.updateLayerColor || ((layer, color) => layer.setStyle({ fillColor: color }));

export class MapPanorama {
    constructor() {
        this.colorMap = {
            'NP': '#FFFFFF',
            0: '#9F9F9F', 
            1: '#72C576',
            2: '#27884A'
        };
        
        this.levelDistribution = null;
        this.municipioLevels = new Map();
        this.municipiosList = []; // Nova propriedade para armazenar a lista de municípios
        console.log('MapPanorama inicializado');

        // Garantir que updateMapColors seja a última alteração
        this.updatePending = false;
        this.updateTimeout = null;

        // Tornar esta instância acessível globalmente
        window.mapPanoramaInstance = this;
    }

    // Inicializa o panorama com os dados da API
    initializePanorama(panoramaData) {
        console.log('Iniciando panorama com dados:', panoramaData);
        
        if (!panoramaData?.levelDistribution) {
            console.error('Dados de distribuição de níveis inválidos:', panoramaData);
            return;
        }

        this.levelDistribution = panoramaData.levelDistribution;
        console.log('Level distribution carregada:', this.levelDistribution);
        
        // Armazenar os dados completos do panorama para uso posterior
        this.panoramaData = panoramaData;
        
        // Mapear municípios para seus níveis
        console.log(this.levelDistribution)
        this.levelDistribution.forEach(level => {
            console.log(`Processando nível ${level.level} com ${level.municipios.length} municípios`);
            level.municipios.forEach(codIbge => {
                this.municipioLevels.set(codIbge, level.level);
            });
        });

        console.log('Mapa de níveis construído:', 
            Array.from(this.municipioLevels.entries()).slice(0, 5), 
            `(mostrando 5 de ${this.municipioLevels.size})`
        );

        // Carregar a lista de municípios
        this.loadMunicipiosList();

        this.updateMapColors();
    }

    // Carrega a lista de municípios a partir do GeoJSON
    loadMunicipiosList() {
        if (!window.geoJSONLayer) {
            console.error('Camada GeoJSON não inicializada');
            return;
        }

        this.municipiosList = [];
        
        window.geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                const id = layer.feature.properties.id;
                const nome = layer.feature.properties.name;
                
                if (id && nome) {
                    this.municipiosList.push({
                        codIbge: id,
                        nome: nome,
                        level: this.getMunicipioLevel(id)
                    });
                }
            }
        });

        // Ordenar por nome
        this.municipiosList.sort((a, b) => a.nome.localeCompare(b.nome));
        
        console.log(`Lista de municípios carregada com ${this.municipiosList.length} itens`);
        
        // Renderizar o select de municípios
        this.renderMunicipioSelect();
    }

    // Renderiza o select de municípios
    renderMunicipioSelect() {
        // Verificar se já existe um container para o select
        let selectContainer = document.getElementById('municipio-select-container');
        
        // Se não existir, criar um novo
        if (!selectContainer) {
            console.log('Criando container para o select de municípios');
            selectContainer = document.createElement('div');
            selectContainer.id = 'municipio-select-container';
            selectContainer.className = 'municipio-select-wrapper mb-3';
            
            // Encontrar o container do mapa para adicionar o select
            const mapContainer = document.querySelector('.right-panel');
            if (mapContainer) {
                console.log({mapContainer, selectContainer})
                // Inserir como primeiro filho em vez de usar insertBefore
                if (mapContainer.firstChild) {
                    mapContainer.insertBefore(selectContainer, mapContainer.firstChild);
                } else {
                    mapContainer.appendChild(selectContainer);
                }
            } else {
                console.error('Container do mapa não encontrado');
                return;
            }
        }
        
        // Criar o HTML do select
        const selectHTML = `
            <div id="mission-filter-alert"></div>
            <div class="form-group">
                <label for="municipio-select" class="form-label">Prefeituras:</label>
                <select id="municipio-select" class="form-select">
                    <option disabled selected value="">Todos os municípios</option>
                    ${this.municipiosList.map(municipio => 
                        `<option value="${municipio.codIbge}">${municipio.nome}</option>`
                    ).join('')}
                </select>
            </div>
            <div id="municipio-map-info" class="mt-3 p-3" style="background: #333333; color: #FFFFFF; border-radius: 8px;">
                <p class="mb-0" style="color: #FFFFFF;">Selecione um município para ver suas informações</p>
            </div>
        `;
        
        // Atualizar o container
        selectContainer.innerHTML = selectHTML;
        
        // Adicionar event listener ao select
        const selectElement = document.getElementById('municipio-select');
        if (selectElement) {
            selectElement.addEventListener('change', (e) => {
                const selectedMunicipioId = e.target.value;
                this.highlightMunicipio(selectedMunicipioId);
                if (selectedMunicipioId) {
                    this.loadMunicipioInfo(selectedMunicipioId);
                } else {
                    this.resetMunicipioInfo();
                }
            });
        }
        
        console.log('Select de municípios renderizado com sucesso');
    }

    // Destaca um município específico no mapa
    highlightMunicipio(codIbge) {
        if (!window.geoJSONLayer) {
            console.error('Camada GeoJSON não inicializada');
            return;
        }
        
        console.log(`Destacando município com código IBGE: ${codIbge}`);
        
        // Resetar todos os municípios para suas cores originais
        window.geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                const id = layer.feature.properties.id;
                const level = this.getMunicipioLevel(id);
                const color = this.colorMap[level] || this.colorMap[0];
                
                // Aplicar estilo normal
                window.updateLayerColor(layer, color);
                layer.setStyle({
                    weight: 1,
                    opacity: 0.5
                });
            }
        });
        
        // Se um município foi selecionado, destacá-lo
        if (codIbge) {
            window.geoJSONLayer.eachLayer(layer => {
                if (layer.feature && layer.feature.properties && layer.feature.properties.id === codIbge) {
                    // Destacar o município selecionado
                    layer.setStyle({
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                    
                    // Centralizar o mapa no município
                    if (window.map) {
                        window.map.fitBounds(layer.getBounds());
                    }
                    
                    // Mostrar tooltip
                    layer.openTooltip();
                }
            });
        } else {
            // Se nenhum município foi selecionado, ajustar a visualização para mostrar todo o mapa
            if (window.map && window.geoJSONLayer) {
                window.map.fitBounds(window.geoJSONLayer.getBounds());
            }
        }
    }

    // Atualiza as cores do mapa baseado nos níveis
    updateMapColors() {
        // Se já existe uma atualização pendente, cancela
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        // Agenda a atualização para o final da fila de eventos
        this.updateTimeout = setTimeout(() => {
            this._executeMapUpdate();
        }, 0);
    }

    _executeMapUpdate() {
        console.log('Iniciando atualização de cores do mapa');
        
        if (!window.map || !window.geoJSONLayer) {
            console.error('Mapa ou camada GeoJSON não inicializados:', {
                map: !!window.map,
                geoJSONLayer: !!window.geoJSONLayer
            });
            return;
        }

        let countByLevel = {0: 0, 1: 0, 2: 0, 3: 0};

        window.geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                const id = layer.feature.properties.id;
                const level = this.getMunicipioLevel(id);
                
                countByLevel[level]++;
                
                const newColor = this.colorMap[level] || this.colorMap[0];
                console.log({newColor, layer})

                if (level > 0) {
                    console.log(`Município ${id} com nível ${level}, aplicando cor ${newColor}`);
                }

                // Usar updateLayerColor em vez de setStyle diretamente
                window.updateLayerColor(layer, newColor);
            }
        });

        console.log('Distribuição final de níveis:', countByLevel);
        this.updateTimeout = null;
    }

    // Obtém o nível de um município específico
    getMunicipioLevel(codIbge) {
        const level = this.municipioLevels.get(codIbge.toString());
        if (level === undefined) {
            console.debug(`Nível não encontrado para município ${codIbge}, retornando 0`);
        }
        return level || 0;
    }

    // Atualiza o tooltip com informações do nível
    updateTooltip(layer) {
        if (layer.feature && layer.feature.properties) {
            const id = layer.feature.properties.id;
            const level = this.getMunicipioLevel(id);
            const nome = layer.feature.properties.name;

            console.debug(`Atualizando tooltip para ${nome} (ID: ${id}) com nível ${level}`);

            layer.bindTooltip(`
                <strong>${nome}</strong><br>
                Nível: ${level}
            `, {
                permanent: false,
                direction: 'left'
            });
        }
    }

    // URL base da API
    getApiBaseUrl() {
        // Verificar se estamos em ambiente de desenvolvimento ou produção
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        return isLocalhost ? 'http://localhost:3000' : '';
    }

    // Carrega e exibe informações detalhadas do município
    loadMunicipioInfo(codIbge) {
        console.log(`Carregando informações do município ${codIbge}`);
        
        // Mostrar indicador de carregamento
        const infoContainer = document.getElementById('municipio-map-info');
        if (infoContainer) {
            infoContainer.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando informações...</p>';
        }
        
        // Verificar se há uma missão selecionada
        const selectedMission = window.missionState?.selectedMission;
        
        if (selectedMission) {
            console.log(`Missão selecionada: ${selectedMission}, carregando desempenho específico`);
            this.loadMunicipioDesempenho(codIbge, selectedMission);
            return;
        }
        
        // Se não há missão selecionada, carregar informações gerais do município
        // Fazer requisição à API para obter dados específicos do município
        const apiUrl = `${this.getApiBaseUrl()}/api/dashboard/map-panorama/${codIbge}`;
        console.log(`Fazendo requisição para: ${apiUrl}`);
        
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Falha ao carregar dados do município');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success' && data.data) {
                    console.log('Dados do município recebidos:', data);
                    this.updateMunicipioInfoFromPanorama(data.data);
                } else {
                    throw new Error('Formato de resposta inválido');
                }
            })
            .catch(error => {
                console.error('Erro ao carregar informações do município:', error);
                if (infoContainer) {
                    infoContainer.innerHTML = '<p class="text-center text-danger">Erro ao carregar informações do município</p>';
                }
            });
    }
    
    // Nova função para carregar o desempenho do município em uma missão específica
    loadMunicipioDesempenho(codIbge, missaoId) {
        console.log(`Carregando desempenho do município ${codIbge} na missão ${missaoId}`);
        
        // Mostrar indicador de carregamento
        const infoContainer = document.getElementById('municipio-map-info');
        if (infoContainer) {
            infoContainer.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando desempenho do município...</p>';
        }
        
        // Fazer requisição à API para obter dados de desempenho
        const apiUrl = `${this.getApiBaseUrl()}/api/desempenhos/municipio/${codIbge}/missao/${missaoId}`;
        console.log(`Fazendo requisição para: ${apiUrl}`);
        
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Falha ao carregar dados de desempenho');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success' && data.data) {
                    console.log('Dados de desempenho recebidos:', data);
                    
                    // Buscar dados gerais do município para manter o cabeçalho
                    const panoramaUrl = `${this.getApiBaseUrl()}/api/dashboard/map-panorama/${codIbge}`;
                    return fetch(panoramaUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Falha ao carregar dados do panorama');
                            }
                            return response.json();
                        })
                        .then(panoramaData => {
                            if (panoramaData.status === 'success' && panoramaData.data) {
                                // Renderizar com os dois conjuntos de dados
                                this.updateMunicipioInfoWithEvidencias(panoramaData.data, data.data);
                            } else {
                                throw new Error('Formato de resposta inválido do panorama');
                            }
                        });
                } else {
                    throw new Error('Formato de resposta inválido');
                }
            })
            .catch(error => {
                console.error('Erro ao carregar desempenho do município:', error);
                if (infoContainer) {
                    infoContainer.innerHTML = '<p class="text-center text-danger">Erro ao carregar desempenho do município</p>';
                }
            });
    }
    
    // Nova função para atualizar as informações do município com as evidências
    updateMunicipioInfoWithEvidencias(panoramaData, desempenhoData) {
        const infoContainer = document.getElementById('municipio-map-info');
        if (!infoContainer) return;
        
        const { mapPanorama, level, totalPoints } = panoramaData;
        const municipio = mapPanorama.municipio;
        const { missao, validation_status, evidence } = desempenhoData;
        
        // Calcular pontos para o nível atual (0-100)
        const pontosNivel = totalPoints % 100;
        
        // Determinar se a missão está concluída
        const isCompleted = validation_status === 'VALID';
        
        // Definir classe e texto de status com base no estado de validação
        let statusClass, statusText;
        switch (validation_status) {
            case 'VALID':
                statusClass = 'bg-success';
                statusText = 'Concluída';
                break;
            case 'STARTED':
                statusClass = 'bg-primary';
                statusText = 'Em andamento';
                break;
            case 'PENDING':
                statusClass = 'bg-secondary';
                statusText = 'Pendente';
                break;
            default:
                statusClass = 'bg-light text-dark';
                statusText = 'Status desconhecido';
        }
        
        // Atualizar o container com o template
        infoContainer.style.background = '#FFFFFF';
        infoContainer.style.color = '#333333';
        infoContainer.innerHTML = `
            <div class="municipality-header">
                <div class="municipality-image skeleton">
                    <div class="municipality-image-placeholder"></div>
                    <img src="${municipio.imagemAvatar || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23f5f5f5"/%3E%3C/svg%3E'}" 
                         alt="${municipio.nome}"
                         class="municipality-image-real"
                         onerror="this.style.display='none'"
                         onload="this.parentElement.classList.remove('skeleton'); this.style.opacity = '1';"
                    />
                </div>
                <div class="municipality-info">
                    <h2>${municipio.nome}</h2>
                    <div class="level-header">
                        <h3>Nível ${level}</h3>
                        <div class="progress-count">${pontosNivel}/100 <i class="fas fa-star"></i></div>
                    </div>
                    <div class="progress" style="position: relative; height: 15px; width: 100%;">
                        <div class="progress-bar"
                             role="progressbar" 
                             style="width: ${pontosNivel}%; background: linear-gradient(to right, #50B755, #066829);" 
                             aria-valuenow="${pontosNivel}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                        </div>
                    </div>
                    <div class="stats">
                        <div class="stat-item pontos">
                            <div class="icon-box"><i class="fas fa-star fa-xl"></i></div>
                            <div class="stat-content">
                                <span class="number">${totalPoints}</span>
                                <span class="label">pontos</span>
                            </div>
                        </div>
                        <div class="stat-item emblemas">
                            <div class="icon-box"><i class="fas fa-medal fa-xl"></i></div>
                            <div class="stat-content">
                                <span class="number">${municipio.badges || 0}</span>
                                <span class="label">emblemas</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="municipality-missions mt-3">
            
                
                <div class="evidence-section mt-3">
                    <h4 class="evidence-title">Evidências</h4>t
                    
                    <div class="evidence-grid" style="display: flex; flex-direction: column; gap: 12px;">
                        ${evidence.filter(ev => ev.title).map(ev => `
                            <${isCompleted ? 'a' : 'div'} 
                                class="evidence-item"
                                ${ev.evidencia ? `href="${ev.evidencia}" target="_blank" rel="noopener noreferrer"` : ''}
                                title="${ev.title || 'Sem descrição disponível'}">
                                <span>${ev.title || 'Evidência'}</span>
                                <i class="fa-solid fa-${isCompleted ? 'external-link' : 'circle-info'} ${isCompleted ? '' : 'info-icon'} fa-xl" 
                                   aria-hidden="true"
                                   data-tooltip="${ev.title || 'Sem descrição disponível'}"></i>
                            </${isCompleted ? 'a' : 'div'}>
                        `).join('')}
                    </div>
                </div>
                
                <div class="mt-3">
                    <button class="btn btn-outline-secondary" id="voltar-panorama">
                        <i class="fas fa-arrow-left"></i> Voltar para visão geral
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar event listener ao botão de voltar
        const btnVoltar = document.getElementById('voltar-panorama');
        if (btnVoltar) {
            btnVoltar.addEventListener('click', () => {
                // Limpar a missão selecionada
                if (window.missionState) {
                    window.missionState.selectedMission = null;
                }
                
                // Recarregar informações gerais do município
                this.loadMunicipioInfo(desempenhoData.municipio.codIbge);
                
                // Limpar filtros do mapa se existir a função
                if (typeof limparFiltrosMapa === 'function') {
                    limparFiltrosMapa();
                }
            });
        }
    }
    
    // Atualiza o container com as informações do município a partir dos dados do panorama específico
    updateMunicipioInfoFromPanorama(data) {
        const infoContainer = document.getElementById('municipio-map-info');
        if (!infoContainer) return;
        
        const { mapPanorama, level, totalPoints } = data;
        const municipio = mapPanorama.municipio;
        
        // Calcular pontos para o nível atual (0-100)
        const pontosNivel = totalPoints % 100;
        
        // Atualizar o container com o template
        infoContainer.style.background = '#FFFFFF';
        infoContainer.style.color = '#333333';
        infoContainer.innerHTML = `
            <div class="municipality-header">
                <div class="municipality-image skeleton">
                    <div class="municipality-image-placeholder"></div>
                    <img src="${municipio.imagemAvatar || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23f5f5f5"/%3E%3C/svg%3E'}" 
                         alt="${municipio.nome}"
                         class="municipality-image-real"
                         onerror="this.style.display='none'"
                         onload="this.parentElement.classList.remove('skeleton'); this.style.opacity = '1';"
                    />
                </div>
                <div class="municipality-info">
                    <h2>${municipio.nome}</h2>
                    <div class="level-header">
                        <h3>Nível ${level}</h3>
                        <div class="progress-count">${pontosNivel}/100 <i class="fas fa-star"></i></div>
                    </div>
                    <div class="progress" style="position: relative; height: 15px; width: 100%;">
                        <div class="progress-bar"
                             role="progressbar" 
                             style="width: ${pontosNivel}%; background: linear-gradient(to right, #50B755, #066829);" 
                             aria-valuenow="${pontosNivel}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                        </div>
                    </div>
                    <div class="stats">
                        <div class="stat-item pontos">
                            <div class="icon-box"><i class="fas fa-star fa-xl"></i></div>
                            <div class="stat-content">
                                <span class="number">${totalPoints}</span>
                                <span class="label">pontos</span>
                            </div>
                        </div>
                        <div class="stat-item emblemas">
                            <div class="icon-box"><i class="fas fa-medal fa-xl"></i></div>
                            <div class="stat-content">
                                <span class="number">${municipio.badges || 0}</span>
                                <span class="label">emblemas</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="municipality-missions mt-3">
                <h4 class="missions-title">Missões</h4>
                <div class="missions-badges d-flex justify-content-between w-100">
                    <span class="badge rounded-pill bg-light text-dark mission-pill flex-fill text-center mx-1">
                        <span class="badge bg-success">${mapPanorama.countStarted}</span> Em ação
                    </span>
                    <span class="badge rounded-pill bg-light text-dark mission-pill flex-fill text-center mx-1">
                        <span class="badge bg-secondary">${mapPanorama.countValid}</span> Concluídas
                    </span>
                    <span class="badge rounded-pill bg-light text-dark mission-pill flex-fill text-center mx-1">
                        <span class="badge bg-dark">${mapPanorama.countPending}</span> Pendentes
                    </span>
                </div>
            </div>
        `;
    }
    
    // Reseta o container de informações para o estado inicial
    resetMunicipioInfo() {
        const infoContainer = document.getElementById('municipio-map-info');
        if (infoContainer) {
            infoContainer.style.background = '#333333';
            infoContainer.style.color = '#FFFFFF';
            infoContainer.innerHTML = '<p class="mb-0" style="color: #FFFFFF;">Selecione um município para ver suas informações</p>';
        }
    }
    
    // Função auxiliar para obter URL da miniatura
    getThumbnailUrl(imageUrl) {
        if (!imageUrl) return null;
        return imageUrl;
    }
}

// Exportar a classe para uso global
window.MapPanorama = MapPanorama; 