// Definir a função global updateLayerColor se ainda não estiver definida
window.updateLayerColor = window.updateLayerColor || ((layer, color) => layer.setStyle({ fillColor: color }));

export class MapPanorama {
    constructor() {
        this.colorMap = {
            'NP': '#FFFFFF',
            'NA': '#FFFFFF',
            0: '#707070', 
            1: '#50B755',
            2: '#066829',
            3: '#12447F'
        };
        
        this.missionColorMap = {
            'NP': '#FFFFFF',
            'NA': '#FFFFFF',
            0: '#9F9F9F',    // Não iniciado
            1: '#72C576',    // Em ação
            2: '#12447F'     // Concluído
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
        
        // Buscar dados de panorama do mapa
        this.fetchMapPanoramaData();
    }
    
    // Buscar dados de panorama do mapa da API
    async fetchMapPanoramaData() {
        console.log('Buscando dados de panorama do mapa...');
        try {
            const response = await fetch('/dashboard/map-panorama');
            if (!response.ok) {
                throw new Error(`Erro ao buscar dados: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Dados do panorama recebidos:', data);
            
            // Processar dados dos municípios
            if (data && data.municipios) {
                // Criar map de níveis de municípios baseado nos dados de desempenho
                const municipioLevelsFromAPI = new Map();
                const participatingMunicipalities = new Set();
                
                data.municipios.forEach(municipio => {
                    const codIbge = municipio.codIbge.toString();
                    
                    // Verificar se há dados de desempenho
                    if (municipio.desempenho) {
                        const level = municipio.desempenho.level;
                        
                        // Armazenar o nível (NP, 0, 1, 2, ou 3)
                        municipioLevelsFromAPI.set(codIbge, level);
                        
                        // Se não for "NP", adicionar aos municípios participantes
                        if (level !== 'NP') {
                            participatingMunicipalities.add(codIbge);
                        }
                    }
                });
                
                // Atualizar o mapa de níveis apenas se houver dados
                if (municipioLevelsFromAPI.size > 0) {
                    this.municipioLevels = municipioLevelsFromAPI;
                    console.log(`Dados de nível atualizados para ${municipioLevelsFromAPI.size} municípios`);
                    
                    // Atualizar conjunto global de municípios participantes
                    window.participatingMunicipalities = participatingMunicipalities;
                    console.log(`${participatingMunicipalities.size} municípios participantes identificados`);
                    
                    // Atualizar cores do mapa com os novos dados
                    this.updateMapColors();
                }
            }
            
        } catch (error) {
            console.error('Erro ao buscar dados de panorama do mapa:', error);
        }
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

        // Inicializar a legenda do mapa
        this.initializeLegend();

        this.updateMapColors();
    }

    // Nova função para inicializar a legenda do mapa
    initializeLegend() {
        console.log('Inicializando legenda do mapa');
        
        // Verificar se o mapa está disponível
        if (!window.map) {
            console.error('Mapa não inicializado para legenda');
            return;
        }
        
        // Remover legenda anterior se existir
        const existingLegend = document.querySelector('.map-legend-control');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Usar a contagem armazenada ou criar um objeto vazio se não existir
        const countByLevel = this.countByLevel || {0: 0, 1: 0, 2: 0, 3: 0, 'NP': 0};
        
        // Criar legenda personalizada como um controle Leaflet
        const legendControl = L.control({ position: 'bottomright' });
        
        legendControl.onAdd = (map) => {
            const div = L.DomUtil.create('div', 'map-legend-control');
            
            // Verificar se estamos em modo de missão selecionada
            const selectedMission = window.missionState?.selectedMission;
            const inMissionMode = !!selectedMission;
            
            let legendContent = '';
            
            if (inMissionMode) {
                // Legenda para quando uma missão está selecionada
                legendContent = `
                    <div class="map-legend-container">
                        <h4>Legenda da Missão</h4>
                        <div class="legend-items">
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #9F9F9F">
                                    <span class="legend-number">${countByLevel[0] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text">Não iniciado</span>
                                </div>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #72C576">
                                    <span class="legend-number">${countByLevel[1] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text">Em ação</span>
                                </div>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #12447F">
                                    <span class="legend-number">${countByLevel[2] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text">Concluído</span>
                                </div>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #FFFFFF; border: 1px solid #ccc">
                                    <span class="legend-number" style="color: #333; text-shadow: none;">${countByLevel['NP'] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text-bold">Não aderiu ao Pacto</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Legenda para quando nenhuma missão está selecionada (padrão)
                legendContent = `
                    <div class="map-legend-container">
                        <h4>Legenda</h4>
                        <div class="legend-items">
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #707070">
                                    <span class="legend-number">${countByLevel[0] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text">Não Iniciado</span>
                                </div>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #50B755">
                                    <span class="legend-number">${countByLevel[1] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text-bold">Nível 1</span>
                                    <span class="legend-text-small">1 até 100 pontos</span>
                                </div>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #066829">
                                    <span class="legend-number">${countByLevel[2] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text-bold">Nível 2</span>
                                    <span class="legend-text-small">101 até 199 pontos</span>
                                </div>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #12447F">
                                    <span class="legend-number">${countByLevel[3] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text-bold">Concluído</span>
                                    <span class="legend-text-small">200 pontos</span>
                                </div>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color-box" style="background-color: #FFFFFF; border: 1px solid #ccc">
                                    <span class="legend-number" style="color: #333; text-shadow: none;">${countByLevel['NP'] || 0}</span>
                                </div>
                                <div class="legend-text-container">
                                    <span class="legend-text-bold">Não aderiu ao Pacto</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            div.innerHTML = legendContent;
            
            // Aplicar estilos inline para garantir consistência
            const style = document.createElement('style');
            style.textContent = `
                .map-legend-control {
                    background: white;
                    padding: 12px;
                    border-radius: 6px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                    max-width: 240px;
                    opacity: 0.9;
                    transition: opacity 0.3s;
                }
                .map-legend-container h4 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    font-weight: bold;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }
                .legend-items {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .legend-color-box {
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    flex-shrink: 0;
                }
                .legend-text-container {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .legend-number {
                    color: white;
                    font-weight: bold;
                    font-size: 13px;
                    text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
                }
                .legend-text {
                    font-size: 13px;
                    color: #444;
                }
                .legend-text-bold {
                    font-size: 13px;
                    color: #333;
                    font-weight: bold;
                }
                .legend-text-small {
                    font-size: 11px;
                    color: #666;
                }
            `;
            
            div.appendChild(style);
            return div;
        };
        
        legendControl.addTo(window.map);
        console.log('Legenda do mapa adicionada com sucesso');
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
                    
                    // Mostrar tooltip - Removido para evitar que o tooltip apareça ao selecionar município
                    // layer.openTooltip();
                }
            });
        } else {
            // Se nenhum município foi selecionado, ajustar a visualização para mostrar todo o mapa
            // if (window.map && window.geoJSONLayer) {
            //     window.map.fitBounds(window.geoJSONLayer.getBounds());
            // }
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
            
            // Garantir que a legenda seja atualizada após as cores
            if (typeof this.updateLegend === 'function') {
                this.updateLegend();
            }
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

        // Verificar se estamos em modo de missão selecionada
        const selectedMission = window.missionState?.selectedMission;
        const inMissionMode = !!selectedMission;
        
        // Escolher o mapa de cores adequado
        const colorMapToUse = inMissionMode ? this.missionColorMap : this.colorMap;

        // Contador para armazenar quantos municípios estão em cada nível
        // Incluindo 'NP' para não participantes (recebido da API) e 'NA' para legado
        const countByLevel = {0: 0, 1: 0, 2: 0, 3: 0, 'NP': 0, 'NA': 0};
        
        // Set para armazenar municípios participantes (para identificar os que não aderiram)
        let participatingMunicipios = window.participatingMunicipalities || new Set();
        console.log(`Atualizando cores com ${participatingMunicipios.size} municípios participantes conhecidos`);
        
        // Contador total de municípios
        let totalMunicipios = 0;

        window.geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                totalMunicipios++;
                
                const id = layer.feature.properties.id;
                const stringId = id.toString();
                
                // Buscar o nível do município do nosso mapa
                const level = this.getMunicipioLevel(id);
                
                // Verificar se o nível é 'NP' (não participante) da API ou
                // se não está no conjunto de municípios participantes
                if (level === 'NP' || (!participatingMunicipios.has(stringId) && !participatingMunicipios.has(parseInt(stringId)))) {
                    // Município não aderiu ao programa
                    countByLevel['NP']++;
                    const newColor = colorMapToUse['NP'] || '#FFFFFF';
                    window.updateLayerColor(layer, newColor);
                } else {
                    // Município é participante, aplicar cores normais
                    countByLevel[level]++;
                    const newColor = colorMapToUse[level] || colorMapToUse[0];
                    window.updateLayerColor(layer, newColor);
                }
            }
        });

        // Verificar se os números fazem sentido
        const totalParticipantes = countByLevel[0] + countByLevel[1] + countByLevel[2] + countByLevel[3];
        if (totalParticipantes + countByLevel['NP'] !== totalMunicipios) {
            console.warn('Discrepância na contagem de municípios:', {
                totalContados: totalParticipantes + countByLevel['NP'],
                totalMunicipios: totalMunicipios
            });
            
            // Corrigir contagem de 'NP' se necessário
            countByLevel['NP'] = totalMunicipios - totalParticipantes;
        }

        console.log('Distribuição final de níveis:', countByLevel);
        console.log('Total de municípios no mapa:', totalMunicipios);
        
        // Para compatibilidade, manter 'NA' igual a 'NP'
        countByLevel['NA'] = countByLevel['NP'];
        
        // Armazenar contagem para usar na legenda
        this.countByLevel = countByLevel;
        
        // Atualizar a legenda para refletir qualquer alteração
        this.updateLegend();
        
        this.updateTimeout = null;
    }

    // Método para atualizar a legenda sem recriá-la completamente
    updateLegend() {
        // Verificar se estamos em modo de missão selecionada
        const selectedMission = window.missionState?.selectedMission;
        const inMissionMode = !!selectedMission;
        
        // Encontrar o elemento da legenda
        const legendElement = document.querySelector('.map-legend-control');
        if (!legendElement) {
            // Se a legenda não existe, criá-la
            this.initializeLegend();
            return;
        }
        
        // Atualizar o título da legenda com base no modo
        const legendTitle = legendElement.querySelector('h4');
        if (legendTitle) {
            legendTitle.textContent = inMissionMode ? 'Legenda da Missão' : 'Legenda';
        }
        
        // Usar a contagem armazenada ou criar um objeto vazio se não existir
        const countByLevel = this.countByLevel || {0: 0, 1: 0, 2: 0, 3: 0, 'NP': 0};
        
        // Atualizar conteúdo da legenda baseado no modo
        const legendItems = legendElement.querySelector('.legend-items');
        
        if (inMissionMode) {
            // Legenda para quando uma missão está selecionada
            legendItems.innerHTML = `
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #9F9F9F">
                        <span class="legend-number">${countByLevel[0] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text">Não iniciado</span>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #72C576">
                        <span class="legend-number">${countByLevel[1] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text">Em ação</span>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #12447F">
                        <span class="legend-number">${countByLevel[2] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text">Concluído</span>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #FFFFFF; border: 1px solid #ccc">
                        <span class="legend-number" style="color: #333; text-shadow: none;">${countByLevel['NP'] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text-bold">Não aderiu ao Pacto</span>
                    </div>
                </div>
            `;
        } else {
            // Legenda para quando nenhuma missão está selecionada (padrão)
            legendItems.innerHTML = `
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #707070">
                        <span class="legend-number">${countByLevel[0] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text">Não Iniciado</span>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #50B755">
                        <span class="legend-number">${countByLevel[1] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text-bold">Nível 1</span>
                        <span class="legend-text-small">1 até 100 pontos</span>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #066829">
                        <span class="legend-number">${countByLevel[2] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text-bold">Nível 2</span>
                        <span class="legend-text-small">101 até 199 pontos</span>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #12447F">
                        <span class="legend-number">${countByLevel[3] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text-bold">Concluído</span>
                        <span class="legend-text-small">200 pontos</span>
                    </div>
                </div>
                <div class="legend-item">
                    <div class="legend-color-box" style="background-color: #FFFFFF; border: 1px solid #ccc">
                        <span class="legend-number" style="color: #333; text-shadow: none;">${countByLevel['NP'] || 0}</span>
                    </div>
                    <div class="legend-text-container">
                        <span class="legend-text-bold">Não aderiu ao Pacto</span>
                    </div>
                </div>
            `;
        }
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
        
        // Primeiro, buscar os detalhes da missão
        const missionUrl = `${this.getApiBaseUrl()}/api/missoes/${missaoId}`;
        console.log(`Buscando detalhes da missão: ${missionUrl}`);
        
        fetch(missionUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Falha ao carregar detalhes da missão');
                }
                return response.json();
            })
            .then(missionData => {
                if (!missionData.status === 'success' || !missionData.data) {
                    throw new Error('Formato de resposta inválido da missão');
                }

                // Depois, buscar o desempenho do município
                const apiUrl = `${this.getApiBaseUrl()}/api/desempenhos/municipio/${codIbge}/missao/${missaoId}`;
                console.log(`Buscando desempenho do município: ${apiUrl}`);
                
                return fetch(apiUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Falha ao carregar dados de desempenho');
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.status === 'success' && data.data) {
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
                                        // Renderizar com os três conjuntos de dados
                                        console.log({missionData: missionData.data})
                                        this.updateMunicipioInfoWithEvidencias(panoramaData.data, data.data, missionData.data);
                                    } else {
                                        throw new Error('Formato de resposta inválido do panorama');
                                    }
                                });
                        } else {
                            throw new Error('Formato de resposta inválido do desempenho');
                        }
                    });
            })
            .catch(error => {
                console.error('Erro ao carregar dados:', error);
                if (infoContainer) {
                    infoContainer.innerHTML = '<p class="text-center text-danger">Erro ao carregar dados</p>';
                }
            });
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
                    <img src="${this.getThumbnailUrl(municipio.imagemAvatar) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23f5f5f5"/%3E%3C/svg%3E'}" 
                         alt="${municipio.nome}"
                         class="municipality-image-real"
                         onerror="console.error('Error loading image:', this.src); this.style.display='none';"
                         onload="this.parentElement.classList.remove('skeleton'); this.style.opacity = '1'; console.log('Image loaded successfully from:', this.src);"
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
                
                <div class="mt-3 d-flex justify-content-center">
                    <button class="evidence-submit-btn w-100" id="btn-ver-perfil">
                        <i class="fas fa-expand-alt mr-2"></i> VER PERFIL COMPLETO <i class="fa fa-external-link ml-2" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar evento de clique ao botão "VER PERFIL"
        const btnVerPerfil = document.getElementById('btn-ver-perfil');
        if (btnVerPerfil) {
            btnVerPerfil.addEventListener('click', () => {
                this.carregarPerfilMunicipio(municipio.codIbge);
            });
        }
    }
    
    // Nova função para atualizar as informações do município com as evidências
    updateMunicipioInfoWithEvidencias(panoramaData, desempenhoData, missionData) {
        const infoContainer = document.getElementById('municipio-map-info');
        if (!infoContainer) return;
        
        const { mapPanorama, level, totalPoints } = panoramaData;
        const municipio = mapPanorama.municipio;
        const { validation_status, evidence } = desempenhoData;
        const missao = missionData;
        
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
                    <img src="${this.getThumbnailUrl(municipio.imagemAvatar) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23f5f5f5"/%3E%3C/svg%3E'}" 
                         alt="${municipio.nome}"
                         class="municipality-image-real"
                         onerror="console.error('Error loading image:', this.src); this.style.display='none';"
                         onload="this.parentElement.classList.remove('skeleton'); this.style.opacity = '1'; console.log('Image loaded successfully from:', this.src);"
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
                    <h4 class="evidence-title">Evidências</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px; margin-bottom: 16px;">
                        ${missao.evidencias.map((ev, index) => {
                            const submittedEvidence = evidence.find(e => e.title === ev.titulo);
                            if (isCompleted && submittedEvidence) {
                                return `
                                    <button type="button" 
                                        class="btn btn-primary"
                                        style="display: flex; align-items: center; justify-content: space-between; padding: 10px 15px; width: 100%;"
                                        ${submittedEvidence.evidencia ? `onclick="window.open('${submittedEvidence.evidencia}', '_blank', 'noopener,noreferrer')"` : ''}
                                        title="${ev.titulo}">
                                        <span style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ev.titulo}</span>
                                        <i class="fa-solid fa-external-link fa-xl" 
                                           aria-hidden="true"></i>
                                    </button>
                                `;
                            } else {
                                return `
                                    <span class="badge rounded-pill text-bg-light"
                                          style="display: flex; align-items: center; justify-content: space-between; padding: 10px 15px; width: 100%; box-shadow: 0 2px 5px rgba(0,0,0,0.15);"
                                          title="${ev.titulo}">
                                        <span style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ev.titulo}</span>
                                        <i class="fa-solid fa-circle-info fa-xl" 
                                           style="color: #12447F; cursor: pointer;"
                                           aria-hidden="true"
                                           data-tooltip="${ev.descricao}"></i>
                                    </span>
                                `;
                            }
                        }).join('')}
                    </div>
                </div>
                
                <div class="mt-3 d-flex flex-column gap-2">
                    <button class="evidence-submit-btn w-100" id="btn-ver-perfil">
                        <i class="fas fa-expand-alt mr-2"></i> VER PERFIL COMPLETO <i class="fa fa-external-link ml-2" aria-hidden="true"></i>
                    </button>
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
        
        // Adicionar evento de clique ao botão "VER PERFIL"
        const btnVerPerfil = document.getElementById('btn-ver-perfil');
        if (btnVerPerfil) {
            btnVerPerfil.addEventListener('click', () => {
                this.carregarPerfilMunicipio(desempenhoData.municipio.codIbge);
            });
        }

        // Adicionar tooltip functionality para os ícones de info
        const infoIcons = document.querySelectorAll('[data-tooltip]');
        infoIcons.forEach(icon => {
            // Create tooltip element once and reuse it
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip-popup';
            
            // Add tooltip to body now, but hidden
            document.body.appendChild(tooltip);
            
            // Show tooltip on mouseenter
            icon.addEventListener('mouseenter', (e) => {
                const existingTooltips = document.querySelectorAll('.custom-tooltip-popup');
                existingTooltips.forEach(t => {
                    if (t !== tooltip) {
                        t.classList.remove('visible');
                    }
                });
                
                tooltip.textContent = e.target.getAttribute('data-tooltip');
                
                // Position tooltip relative to the icon
                const rect = e.target.getBoundingClientRect();
                
                tooltip.style.top = (rect.top - 10) + 'px';
                tooltip.style.left = (rect.left + rect.width/2) + 'px';
                
                // Show the tooltip
                tooltip.classList.add('visible');
                tooltip.classList.add('animating-in');
                setTimeout(() => {
                    tooltip.classList.remove('animating-in');
                }, 200);
            });
            
            // Hide tooltip on mouseleave
            icon.addEventListener('mouseleave', () => {
                tooltip.classList.add('animating-out');
                setTimeout(() => {
                    tooltip.classList.remove('visible');
                    tooltip.classList.remove('animating-out');
                }, 200);
            });
        });
    }
    
    // Função para carregar e exibir o perfil completo do município
    carregarPerfilMunicipio(codIbge) {
        console.log(`Carregando perfil completo do município ${codIbge}`);
        
        try {
            // Primeiro, alternar para o modo de visualização de perfil
            this.toggleMapVisibility(false);
            
            // Mostrar indicador de carregamento
            const infoContainer = document.getElementById('municipio-map-info');
            console.log('Info container encontrado:', !!infoContainer);
            
            if (infoContainer) {
                infoContainer.innerHTML = `
                    <div class="perfil-completo" style="padding: 20px;">
                        <div class="perfil-header d-flex justify-content-between align-items-center mb-3">
                            <h2 class="m-0">Perfil Completo</h2>
                        </div>
                        <div class="loading-indicator d-flex flex-column align-items-center justify-content-center py-5">
                            <div class="spinner-border text-primary mb-3" role="status">
                                <span class="visually-hidden">Carregando...</span>
                            </div>
                            <p class="text-center text-muted">Carregando perfil completo do município...</p>
                        </div>
                        <div class="back-to-top mt-4">
                            <button id="btn-cancelar-carregamento" class="btn btn-outline-secondary w-100">
                                <i class="fa fa-arrow-left"></i> VOLTAR
                            </button>
                        </div>
                    </div>
                `;
                
                console.log('Conteúdo de carregamento renderizado');
                
                // Adicionar evento ao botão de cancelar carregamento
                const btnCancelar = document.getElementById('btn-cancelar-carregamento');
                if (btnCancelar) {
                    btnCancelar.addEventListener('click', () => {
                        console.log('Botão cancelar clicado');
                        // Voltar para a visualização normal
                        this.toggleMapVisibility(true);
                        
                        // Recarregar informações básicas do município
                        this.loadMunicipioInfo(codIbge);
                    });
                    console.log('Event listener adicionado ao botão cancelar');
                } else {
                    console.warn('Botão cancelar não encontrado!');
                }
            } else {
                console.error('Container municipio-map-info não encontrado!');
            }
            
            // Buscar dados completos do município pela API
            const apiUrl = `${this.getApiBaseUrl()}/api/municipios/${codIbge}`;
            console.log(`Fazendo requisição para: ${apiUrl}`);
            
            fetch(apiUrl)
                .then(response => {
                    console.log('Resposta da API recebida:', response.status);
                    if (!response.ok) {
                        throw new Error(`Falha ao carregar dados do município. Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Dados JSON recebidos da API');
                    if (data.status === 'success' && data.data) {
                        console.log('Dados do perfil recebidos com sucesso!');
                        this.renderizarPerfilMunicipio(data.data);
                    } else {
                        console.error('Formato de resposta inválido:', data);
                        throw new Error('Formato de resposta inválido');
                    }
                })
                .catch(error => {
                    console.error('Erro ao carregar perfil do município:', error);
                    if (infoContainer) {
                        infoContainer.innerHTML = `
                            <div class="perfil-completo" style="padding: 20px;">
                                <div class="perfil-header d-flex justify-content-between align-items-center mb-3">
                                    <h2 class="m-0">Perfil Completo</h2>
                                </div>
                                <div class="alert alert-danger" role="alert">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    Erro ao carregar perfil do município: ${error.message}
                                </div>
                                <div class="back-to-top mt-4">
                                    <button id="btn-voltar-erro" class="btn btn-primary w-100">
                                        <i class="fa fa-arrow-left"></i> VOLTAR PARA VISUALIZAÇÃO NORMAL
                                    </button>
                                </div>
                            </div>
                        `;
                        
                        // Adicionar evento ao botão de voltar em caso de erro
                        const btnVoltar = document.getElementById('btn-voltar-erro');
                        if (btnVoltar) {
                            btnVoltar.addEventListener('click', () => {
                                // Mostrar o mapa novamente
                                this.toggleMapVisibility(true);
                                
                                // Recarregar informações gerais do município
                                this.loadMunicipioInfo(codIbge);
                            });
                        }
                    }
                });
        } catch (error) {
            console.error('Erro geral ao carregar perfil:', error);
        }
    }
    
    // Função para renderizar o perfil completo do município
    renderizarPerfilMunicipio(municipioData) {
        console.log('Iniciando renderização do perfil completo');
        
        const infoContainer = document.getElementById('municipio-map-info');
        if (!infoContainer) {
            console.error('Container municipio-map-info não encontrado durante renderização!');
            return;
        }
        
        try {
            const municipio = municipioData;
            console.log('Dados do município:', municipio.nome);
            
            const desempenhos = municipioData.desempenhos || [];
            console.log(`Total de desempenhos: ${desempenhos.length}`);
            
            // Calcular pontos para o nível atual (0-100)
            const nivel = Math.floor(municipio.points / 100) + 1;
            const pontosNivel = municipio.points % 100;
            
            // Agrupar desempenhos por categoria
            const desempenhosPorCategoria = {};
            desempenhos.forEach(desempenho => {
                const categoria = desempenho.missao.categoria;
                if (!desempenhosPorCategoria[categoria]) {
                    desempenhosPorCategoria[categoria] = [];
                }
                desempenhosPorCategoria[categoria].push(desempenho);
            });
            
            // Contar concluídas por categoria
            const concluídasPorCategoria = {};
            Object.keys(desempenhosPorCategoria).forEach(categoria => {
                concluídasPorCategoria[categoria] = desempenhosPorCategoria[categoria].filter(
                    d => d.validation_status === 'VALID'
                ).length;
            });
            
            // Criar HTML do perfil
            console.log('Gerando HTML do perfil');
            
            const municipalityHTML = `
                <div class="municipality-header">
                    <div class="municipality-image skeleton">
                        <div class="municipality-image-placeholder"></div>
                        <img src="${this.getThumbnailUrl(municipio.imagemAvatar) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23f5f5f5"/%3E%3C/svg%3E'}" 
                             alt="${municipio.nome}"
                             class="municipality-image-real"
                             onerror="console.error('Error loading image:', this.src); this.style.display='none';"
                             onload="this.parentElement.classList.remove('skeleton'); this.style.opacity = '1'; console.log('Image loaded successfully from:', this.src);"
                        />
                    </div>
                    <div class="municipality-info">
                        <h2>${municipio.nome}</h2>
                        <p>Agentes de Transformação</p>
                        <div class="level-header">
                            <h3>Nível ${nivel}</h3>
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
                        <p class="progress-helper">Complete missões para ganhar pontos e subir de nível.</p>
                        <div class="stats">
                            <div class="stat-item pontos">
                                <div class="icon-box"><i class="fas fa-star fa-xl"></i></div>
                                <div class="stat-content">
                                    <span class="number">${municipio.points}</span>
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
            `;
            
            console.log('HTML do município gerado');
            
            // Criar HTML dos emblemas
            const categorias = ['CTG1', 'CTG2', 'CTG3'];
            
            const emblemasHTML = `
                <div class="distintivos-section mt-4">
                    <h4>Emblemas</h4>
                    <p class="emblema-subtitle">Complete missões para ganhar novos emblemas.</p>
                    <div class="distintivos-grid d-flex justify-content-between mt-3">
                        ${categorias.map(categoria => {
                            const count = concluídasPorCategoria[categoria] || 0;
                            const total = desempenhosPorCategoria[categoria]?.length || 0;
                            const isEmpty = count === 0;
                            const emblemaTitle = this.getCategoryName(categoria);
                            
                            return `
                                <div class="distintivo ${isEmpty ? 'empty' : ''}" style="flex: 1; text-align: center; border-radius: 8px; ${isEmpty ? 'opacity: 0.5;' : ''}">
                                    <div class="icon position-relative" data-count="${count}">
                                        ${window.getIconByCategoryId ? window.getIconByCategoryId(categoria) : '<i class="fas fa-award fa-2x"></i>'}
                                    </div>
                                    <p class="emblema-title">${emblemaTitle}</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            
            console.log('HTML dos emblemas gerado');
            
            // Criar HTML das missões
            let missoesHTML = '';
            
            try {
                missoesHTML = `
                    <div class="missoes-section mt-4">
                        <h4>Missões</h4>
                        <p>Complete as missões para ganhar pontos e distintivos!</p>
                        
                        <div class="missao-list mt-3">
                            ${desempenhos.map(desempenho => {
                                try {
                                    const isCompleted = desempenho.validation_status === 'VALID';
                                    const missao = desempenho.missao;
                                    
                                    // Usar try/catch para processar evidence e evidenciasMissao
                                    let evidence = [];
                                    try {
                                        evidence = JSON.parse(desempenho.evidence || '[]');
                                    } catch (e) {
                                        console.warn('Erro ao parsear evidência:', e);
                                        evidence = [];
                                    }
                                    
                                    let evidenciasMissao = [];
                                    try {
                                        evidenciasMissao = JSON.parse(missao.evidencias || '[]');
                                    } catch (e) {
                                        console.warn('Erro ao parsear evidências da missão:', e);
                                        evidenciasMissao = [];
                                    }
                                    
                                    return `
                                        <div class="missao-item mb-4 ${isCompleted ? 'completed' : ''}">
                                            <div class="missao-header" style="background: ${this.getCategoryBackground(missao.categoria)};">
                                                <div class="category-chip" style="background: ${this.getCategoryBackground(missao.categoria)};">
                                                    <span class="category-description">${missao.descricao_da_categoria}</span>
                                                </div>
                                                
                                                <div class="missao-icon">
                                                    ${window.getIconByCategoryId ? window.getIconByCategoryId(missao.categoria) : '<i class="fas fa-tasks"></i>'}
                                                </div>
                                                <div class="missao-content">
                                                    <div class="mission-description-wrapper">
                                                        <p class="mission-description">${missao.descricao_da_missao}</p>
                                                    </div>
                                                    <div class="mission-status-wrapper">
                                                        ${isCompleted ? 
                                                            `<span class="badge rounded-pill bg-success">
                                                                <i class="fas fa-check-circle"></i> Missão concluída
                                                            </span>` : ''
                                                        }
                                                        <div class="points-chip">
                                                            <span>+${missao.qnt_pontos}</span>
                                                            <i class="fas fa-star fa-xl"></i>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="evidence-section">
                                                <h3 class="evidence-title">Evidências</h3>
                                                <p class="evidence-description">${isCompleted ? 'Visualize as evidências enviadas para esta missão.' : 'Evidências necessárias para concluir a missão:'}</p>
                                                
                                                <div class="evidence-grid">
                                                    ${evidenciasMissao.map(ev => {
                                                        const submittedEvidence = evidence.find(e => e.title === ev.titulo);
                                                        
                                                        if (isCompleted && submittedEvidence) {
                                                            return `
                                                                <a href="${submittedEvidence.evidencia}" target="_blank" rel="noopener noreferrer"
                                                                   class="evidence-item">
                                                                    <span>${ev.titulo}</span>
                                                                    <i class="fa-solid fa-external-link fa-xl"></i>
                                                                </a>
                                                            `;
                                                        } else {
                                                            return `
                                                                <div class="evidence-item">
                                                                    <span>${ev.titulo}</span>
                                                                    <i class="fa-solid fa-circle-info fa-xl info-icon" 
                                                                       data-tooltip="${ev.descricao || 'Sem descrição'}"></i>
                                                                </div>
                                                            `;
                                                        }
                                                    }).join('')}
                                                </div>
                                                
                                                ${!isCompleted && missao.link_formulario ? `
                                                    <div class="evidence-divider"></div>
                                                    <div class="evidence-button-container">
                                                        <a href="${missao.link_formulario}" target="_blank" rel="noopener noreferrer" class="evidence-submit-btn">
                                                            Enviar evidências
                                                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                                        </a>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                } catch (error) {
                                    console.error('Erro ao processar desempenho individual:', error);
                                    return `
                                        <div class="missao-item mb-4">
                                            <div class="alert alert-warning">
                                                Erro ao processar informações da missão
                                            </div>
                                        </div>
                                    `;
                                }
                            }).join('')}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Erro ao gerar HTML das missões:', error);
                missoesHTML = `
                    <div class="missoes-section mt-4">
                        <h4>Missões</h4>
                        <div class="alert alert-warning">
                            Ocorreu um erro ao carregar as missões
                        </div>
                    </div>
                `;
            }
            
            console.log('HTML das missões gerado');
            
            // Criar botões de voltar para o mapa
            const btnVoltarLeftHTML = `
                <button id="btn-voltar-left" class="btn btn-primary w-100 mt-4">
                    <i class="fa fa-arrow-left"></i> VOLTAR AO MAPA
                </button>
            `;
            
            const btnVoltarRightHTML = `
                <button id="btn-voltar-right" class="btn btn-primary w-100 mt-4">
                    <i class="fa fa-arrow-left"></i> VOLTAR AO MAPA
                </button>
            `;
            
            // Limpar o container e configurar para modo overlay
            document.body.style.overflow = 'hidden';
            
            // Criar overlay de perfil completo
            const perfilOverlay = document.createElement('div');
            perfilOverlay.id = 'perfil-overlay';
            perfilOverlay.className = 'perfil-overlay';
            perfilOverlay.style.position = 'fixed';
            perfilOverlay.style.top = '0';
            perfilOverlay.style.left = '0';
            perfilOverlay.style.width = '100%';
            perfilOverlay.style.height = '100%';
            perfilOverlay.style.backgroundColor = '#fff';
            perfilOverlay.style.zIndex = '9999';
            perfilOverlay.style.display = 'flex';
            perfilOverlay.style.flexDirection = 'row';
            perfilOverlay.style.overflow = 'hidden';
            
            // Construir o layout de dois painéis
            perfilOverlay.innerHTML = `
                <div class="two-panel-container" style="display: flex; width: 100%; height: 100%;">
                    <div class="left-panel-content" style="width: 45%; height: 100%; overflow-y: auto; padding: 20px; border-right: 1px solid #eee;">
                        <div class="perfil-header d-flex justify-content-between align-items-center mb-3">
                            <h2 class="m-0">Perfil do Município</h2>
                            <button id="btn-fechar-perfil" class="btn-fechar-perfil">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </div>
                        <div class="left-panel-inner">
                            ${municipalityHTML}
                            ${emblemasHTML}
                            ${btnVoltarLeftHTML}
                        </div>
                    </div>
                    <div class="right-panel-content" style="width: 55%; height: 100%; overflow-y: auto; padding: 20px;">
                        <div class="perfil-header d-flex justify-content-between align-items-center mb-3">
                            <h2 class="m-0">Missões</h2>
                        </div>
                        <div class="right-panel-inner">
                            ${missoesHTML}
                            ${btnVoltarRightHTML}
                        </div>
                    </div>
                </div>
            `;
            
            // Adicionar overlay ao body
            document.body.appendChild(perfilOverlay);
            
            console.log('HTML completo renderizado');
            
            // Esconder outros elementos
            if (document.querySelector('.map-container')) {
                document.querySelector('.map-container').style.display = 'none';
            }
            
            if (document.getElementById('panorama-missoes')) {
                document.getElementById('panorama-missoes').style.display = 'none';
            }
            
            // Adicionar evento aos botões de voltar
            const btnVoltarLeft = document.getElementById('btn-voltar-left');
            if (btnVoltarLeft) {
                btnVoltarLeft.addEventListener('click', () => {
                    console.log('Botão voltar esquerdo clicado');
                    // Restaurar scroll
                    document.body.style.overflow = '';
                    
                    // Remover overlay
                    if (perfilOverlay && perfilOverlay.parentNode) {
                        perfilOverlay.parentNode.removeChild(perfilOverlay);
                    }
                    
                    // Mostrar o mapa novamente
                    this.toggleMapVisibility(true);
                    
                    // Recarregar informações gerais do município
                    this.loadMunicipioInfo(municipio.codIbge);
                });
            }
            
            const btnVoltarRight = document.getElementById('btn-voltar-right');
            if (btnVoltarRight) {
                btnVoltarRight.addEventListener('click', () => {
                    console.log('Botão voltar direito clicado');
                    // Restaurar scroll
                    document.body.style.overflow = '';
                    
                    // Remover overlay
                    if (perfilOverlay && perfilOverlay.parentNode) {
                        perfilOverlay.parentNode.removeChild(perfilOverlay);
                    }
                    
                    // Mostrar o mapa novamente
                    this.toggleMapVisibility(true);
                    
                    // Recarregar informações gerais do município
                    this.loadMunicipioInfo(municipio.codIbge);
                });
            }
            
            // Adicionar evento ao botão de fechar perfil
            const btnFechar = document.getElementById('btn-fechar-perfil');
            if (btnFechar) {
                btnFechar.addEventListener('click', () => {
                    console.log('Botão fechar perfil clicado');
                    // Restaurar scroll
                    document.body.style.overflow = '';
                    
                    // Remover overlay
                    if (perfilOverlay && perfilOverlay.parentNode) {
                        perfilOverlay.parentNode.removeChild(perfilOverlay);
                    }
                    
                    // Mostrar o mapa novamente
                    this.toggleMapVisibility(true);
                    
                    // Recarregar informações gerais do município
                    this.loadMunicipioInfo(municipio.codIbge);
                });
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao renderizar perfil:', error);
            return false;
        }
    }

    // Método de fallback para garantir que o perfil esteja visível
    ensureProfileVisibility(codIbge) {
        console.log('Verificando visibilidade do perfil...');
        
        // Verificar se o overlay existe
        const perfilOverlay = document.getElementById('perfil-overlay');
        
        if (!perfilOverlay) {
            console.warn('Overlay do perfil não encontrado! Recriando...');
            
            // Criar overlay de emergência
            const emergencyOverlay = document.createElement('div');
            emergencyOverlay.id = 'emergency-perfil-overlay';
            emergencyOverlay.style.position = 'fixed';
            emergencyOverlay.style.top = '0';
            emergencyOverlay.style.left = '0';
            emergencyOverlay.style.width = '100%';
            emergencyOverlay.style.height = '100%';
            emergencyOverlay.style.backgroundColor = '#fff';
            emergencyOverlay.style.zIndex = '10000';
            emergencyOverlay.style.padding = '20px';
            emergencyOverlay.style.overflow = 'auto';
            
            // Adicionar botão de retorno de emergência
            emergencyOverlay.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2>Modo de Emergência - Perfil</h2>
                    <button id="emergency-back-btn" class="btn btn-danger">
                        <i class="fa fa-arrow-left"></i> Voltar ao Mapa
                    </button>
                </div>
                <div class="alert alert-warning">
                    <p>O perfil não pôde ser exibido corretamente. Tente novamente.</p>
                </div>
            `;
            
            document.body.appendChild(emergencyOverlay);
            
            // Adicionar evento ao botão de emergência
            const emergencyBtn = document.getElementById('emergency-back-btn');
            if (emergencyBtn) {
                emergencyBtn.addEventListener('click', () => {
                    console.log('Botão de emergência clicado');
                    // Restaurar scroll
                    document.body.style.overflow = '';
                    
                    // Remover overlay de emergência
                    if (emergencyOverlay && emergencyOverlay.parentNode) {
                        emergencyOverlay.parentNode.removeChild(emergencyOverlay);
                    }
                    
                    // Mostrar o mapa novamente
                    this.toggleMapVisibility(true);
                    
                    // Recarregar informações gerais do município
                    this.loadMunicipioInfo(codIbge);
                });
            }
            
            // Esconder outros elementos
            if (document.querySelector('.map-container')) {
                document.querySelector('.map-container').style.display = 'none';
            }
            
            if (document.getElementById('panorama-missoes')) {
                document.getElementById('panorama-missoes').style.display = 'none';
            }
            
            // Tentar recarregar o perfil completo
            setTimeout(() => {
                this.carregarPerfilMunicipio(codIbge);
            }, 1000);
            
            return;
        }
        
        // Verificar se os painéis existem
        const leftPanel = document.querySelector('.left-panel-content');
        const rightPanel = document.querySelector('.right-panel-content');
        
        // Se o overlay existe mas não está visível, corrigir
        if (perfilOverlay.offsetHeight === 0 || getComputedStyle(perfilOverlay).display === 'none') {
            console.warn('Overlay do perfil existe mas não está visível! Ajustando...');
            
            // Forçar visibilidade
            perfilOverlay.style.display = 'flex';
            perfilOverlay.style.visibility = 'visible';
            perfilOverlay.style.opacity = '1';
            perfilOverlay.style.zIndex = '9999';
            
            // Esconder outros elementos para evitar sobreposição
            if (document.querySelector('.map-container')) {
                document.querySelector('.map-container').style.display = 'none';
            }
            
            if (document.getElementById('panorama-missoes')) {
                document.getElementById('panorama-missoes').style.display = 'none';
            }
        }
        
        // Verificar painéis específicos
        if (!leftPanel || !rightPanel) {
            console.warn('Painéis do perfil não encontrados! Recriando o overlay...');
            // Remover overlay atual
            if (perfilOverlay && perfilOverlay.parentNode) {
                perfilOverlay.parentNode.removeChild(perfilOverlay);
            }
            // Recarregar perfil
            setTimeout(() => {
                this.carregarPerfilMunicipio(codIbge);
            }, 500);
            return;
        }
        
        // Verificar se os painéis estão visíveis
        if (leftPanel.offsetHeight === 0 || rightPanel.offsetHeight === 0) {
            console.warn('Painéis do perfil não estão visíveis! Ajustando...');
            
            leftPanel.style.display = 'block';
            leftPanel.style.visibility = 'visible';
            leftPanel.style.opacity = '1';
            
            rightPanel.style.display = 'block';
            rightPanel.style.visibility = 'visible';
            rightPanel.style.opacity = '1';
            
            // Garantir que as missões estejam visíveis
            const missoesSection = rightPanel.querySelector('.missoes-section');
            if (missoesSection) {
                missoesSection.style.display = 'block';
                missoesSection.style.visibility = 'visible';
                missoesSection.style.opacity = '1';
                
                // Verificar itens de missão
                const missaoItems = missoesSection.querySelectorAll('.missao-item');
                missaoItems.forEach(item => {
                    item.style.display = 'flex';
                    item.style.visibility = 'visible';
                    item.style.opacity = '1';
                });
            }
        }
    }

    // Função para alternar visibilidade do mapa
    toggleMapVisibility(show) {
        console.log(`Alterando visibilidade do mapa para: ${show ? 'mostrar' : 'esconder'}`);
        
        // Remover qualquer overlay existente
        const existingOverlay = document.getElementById('perfil-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
            console.log('Overlay removido');
        }
        
        // Remover overlay de emergência se existir
        const emergencyOverlay = document.getElementById('emergency-perfil-overlay');
        if (emergencyOverlay) {
            emergencyOverlay.remove();
            console.log('Overlay de emergência removido');
        }
        
        // Restaurar scroll do body
        document.body.style.overflow = '';
        
        if (show) {
            // Elementos principais da interface
            const mapContainer = document.querySelector('.map-container');
            const selectContainer = document.querySelector('.select-container');
            const leftPanel = document.querySelector('.left-panel');
            const rightPanel = document.querySelector('.right-panel');
            const panoramaContainer = document.getElementById('panorama-missoes');
            const municipioInfo = document.getElementById('municipio-map-info');
            const container = document.querySelector('.container');
            
            // Mostrar o mapa
            if (mapContainer) {
                mapContainer.style.display = 'block';
                mapContainer.style.visibility = 'visible';
                mapContainer.style.opacity = '1';
                console.log('Mapa restaurado');
            }
            
            // Mostrar o panorama de missões
            if (panoramaContainer) {
                panoramaContainer.style.display = 'block';
                panoramaContainer.style.visibility = 'visible';
                panoramaContainer.style.opacity = '1';
                console.log('Panorama de missões restaurado');
            }
            
            // Restaurar painéis laterais
            if (leftPanel) {
                leftPanel.style.display = '';
                leftPanel.style.visibility = '';
                leftPanel.style.opacity = '';
                leftPanel.style.width = '';
                leftPanel.style.flex = '';
                leftPanel.classList.remove('collapsed');
                console.log('Painel esquerdo restaurado');
            }
            
            if (rightPanel) {
                rightPanel.style.display = '';
                rightPanel.style.visibility = '';
                rightPanel.style.opacity = '';
                rightPanel.style.width = '';
                rightPanel.style.maxWidth = '';
                rightPanel.style.flex = '';
                rightPanel.style.background = '';
                rightPanel.style.zIndex = '';
                rightPanel.style.overflow = '';
                rightPanel.style.height = '';
                rightPanel.classList.remove('expanded');
                console.log('Painel direito restaurado');
            }
            
            // Verificar se o mapa Leaflet precisa ser atualizado
            if (window.map) {
                window.map.invalidateSize();
                console.log('Tamanho do mapa atualizado');
                
                // Se existir a camada GeoJSON, atualizar as cores
                if (window.geoJSONLayer) {
                    this.updateMapColors();
                    console.log('Cores do mapa atualizadas');
                }
            }
            
            // Verificar se há uma missão selecionada
            if (window.missionState && window.missionState.selectedMission) {
                console.log(`Há uma missão selecionada (${window.missionState.selectedMission}), destacando-a`);
                // Se existir a função global para destacar a missão, chamá-la
                if (typeof highlightSelectedMission === 'function') {
                    highlightSelectedMission(window.missionState.selectedMission);
                }
            }
            
            // Verificar se existe panorama de missões e se precisa ser recarregado
            if (typeof carregarDadosLocais === 'function' && panoramaContainer) {
                console.log('Recarregando dados do panorama de missões');
                carregarDadosLocais();
            }
        } else {
            console.log('Ocultando a visualização do mapa');
            
            // Ocultar mapa e panorama
            const mapContainer = document.querySelector('.map-container');
            if (mapContainer) {
                mapContainer.style.display = 'none';
            }
            
            const panoramaContainer = document.getElementById('panorama-missoes');
            if (panoramaContainer) {
                panoramaContainer.style.display = 'none';
            }
        }
    }
    
    // Função auxiliar para inicializar tooltips
    initializeTooltips() {
        const infoIcons = document.querySelectorAll('[data-tooltip]');
        console.log(`Inicializando ${infoIcons.length} tooltips`);
        
        infoIcons.forEach(icon => {
            // Create tooltip element once and reuse it
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip-popup';
            
            // Add tooltip to body now, but hidden
            document.body.appendChild(tooltip);
            
            // Show tooltip on mouseenter
            icon.addEventListener('mouseenter', (e) => {
                const existingTooltips = document.querySelectorAll('.custom-tooltip-popup');
                existingTooltips.forEach(t => {
                    if (t !== tooltip) {
                        t.classList.remove('visible');
                    }
                });
                
                tooltip.textContent = e.target.getAttribute('data-tooltip');
                
                // Position tooltip relative to the icon
                const rect = e.target.getBoundingClientRect();
                
                tooltip.style.top = (rect.top - 10) + 'px';
                tooltip.style.left = (rect.left + rect.width/2) + 'px';
                
                // Show the tooltip
                tooltip.classList.add('visible');
                tooltip.classList.add('animating-in');
                setTimeout(() => {
                    tooltip.classList.remove('animating-in');
                }, 200);
            });
            
            // Hide tooltip on mouseleave
            icon.addEventListener('mouseleave', () => {
                tooltip.classList.add('animating-out');
                setTimeout(() => {
                    tooltip.classList.remove('visible');
                    tooltip.classList.remove('animating-out');
                }, 200);
            });
        });
    }
    
    // Função auxiliar para obter o nome da categoria
    getCategoryName(categoryId) {
        const categoryNames = {
            'CTG1': 'Ampliação e Qualificação dos Serviços',
            'CTG2': 'Fortalecimento da Governança',
            'CTG3': 'Melhoria da Gestão de Recursos'
        };
        
        return categoryNames[categoryId] || categoryId;
    }
    
    // Função auxiliar para obter o background da categoria
    getCategoryBackground(categoryId) {
        const backgroundMap = {
            'CTG1': 'linear-gradient(to right, #3D5E85, #5E7DA0)',
            'CTG2': 'linear-gradient(to right, #256F93, #5B97B5)',
            'CTG3': 'linear-gradient(to right, #1C434F, #0A5166)'
        };
        
        return backgroundMap[categoryId] || backgroundMap['CTG1'];
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
        
        console.log('getThumbnailUrl', imageUrl);
        
        // Verificar se é uma URL do Google Drive - suporta ambos os formatos
        let imageId = null;
        
        // Formato 1: /d/{id}/ (link de compartilhamento padrão)
        const regexPath = /\/d\/(.*?)(\/|$)/;
        const matchPath = imageUrl.match(regexPath);
        
        // Formato 2: id={id} (URLs de exportação e visualização)
        const regexQuery = /[?&]id=([^&]+)/;
        const matchQuery = imageUrl.match(regexQuery);
        
        if (matchPath && matchPath[1]) {
            imageId = matchPath[1];
        } else if (matchQuery && matchQuery[1]) {
            imageId = matchQuery[1];
        }
        
        if (imageId) {
            console.log(`Converting Drive URL to thumbnail. ID: ${imageId}`);
            
            // Usar o padrão exato solicitado
            return `https://drive.google.com/thumbnail?id=${imageId}`;
        }
        
        return imageUrl; // Retorna a URL original se não for do Google Drive
    }
}

// Exportar a classe para uso global
window.MapPanorama = MapPanorama; 