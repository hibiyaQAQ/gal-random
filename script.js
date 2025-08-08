// Bangumi目录随机抽取器
class BangumiRandomPicker {
    constructor() {
        this.accessToken = null;
        this.username = null;
        this.currentIndex = null;
        this.currentIndexItems = [];
        this.customGamePool = []; // 自定义游戏池
        this.pickHistory = []; // 抽取历史记录
        this.excludeHistory = false; // 是否排除历史记录
        this.darkMode = false; // 深色模式
        this.theme = 'default'; // 主题：default/sunset/forest/ocean
        this.filters = {
            yearRange: { min: null, max: null },
            ratingRange: { min: null, max: null }
        }; // 筛选条件
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
        this.loadCustomPool(); // 加载保存的自定义游戏池
        this.loadPickHistory(); // 加载抽取历史
        this.loadSettings(); // 加载设置
        this.updatePoolStatus(); // 初始化游戏池状态显示
    }

    bindEvents() {
        // 登录相关事件
        document.getElementById('bangumi-login-btn').addEventListener('click', () => this.login());
        document.getElementById('bangumi-logout-btn').addEventListener('click', () => this.logout());
        
        // 目录搜索相关事件
        document.getElementById('search-btn').addEventListener('click', () => this.searchIndex());
        document.getElementById('index-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchIndex();
            }
        });
        
        // 游戏搜索相关事件
        document.getElementById('game-search-btn').addEventListener('click', () => this.searchGames());
        document.getElementById('game-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchGames();
            }
        });
        
        // 随机抽取事件
        // 随机抽取事件
        document.getElementById('random-pick-btn').addEventListener('click', () => this.randomPick());
        document.getElementById('batch-pick-btn').addEventListener('click', () => this.batchPick());
        document.getElementById('random-again-btn').addEventListener('click', () => this.randomPick());
        
        // 游戏池管理事件
        document.getElementById('view-custom-pool-btn').addEventListener('click', () => this.viewCustomPool());
        document.getElementById('clear-custom-pool-btn').addEventListener('click', () => this.clearCustomPool());
        document.getElementById('close-custom-pool-modal').addEventListener('click', () => this.closeCustomPoolModal());
        
        // 历史记录和设置事件
        // 历史记录和设置事件
        document.getElementById('view-history-btn').addEventListener('click', () => this.viewHistory());
        document.getElementById('clear-history-btn').addEventListener('click', () => this.clearHistory());
        document.getElementById('close-history-modal').addEventListener('click', () => this.closeHistoryModal());
        document.getElementById('exclude-history-checkbox').addEventListener('change', (e) => {
            this.excludeHistory = e.target.checked;
            this.saveSettings();
        });
        document.getElementById('dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }
        
        // 筛选功能事件
        // 筛选功能事件
        document.getElementById('toggle-filters-btn').addEventListener('click', () => this.toggleFilters());
        document.getElementById('apply-filters-btn').addEventListener('click', () => this.applyFilters());
        document.getElementById('clear-filters-btn').addEventListener('click', () => this.clearFilters());
        
        // 其他事件
        document.getElementById('visit-bangumi-btn').addEventListener('click', () => this.visitBangumiPage());
        document.getElementById('error-close-btn').addEventListener('click', () => this.hideError());
        const importWishBtn = document.getElementById('import-wish-btn');
        if (importWishBtn) {
            importWishBtn.addEventListener('click', () => this.importWishGamesToPool());
        }
        
        // 模态框点击外部关闭
        // 模态框点击外部关闭
        document.getElementById('custom-pool-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('custom-pool-modal')) {
                this.closeCustomPoolModal();
            }
        });
        
        document.getElementById('history-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('history-modal')) {
                this.closeHistoryModal();
            }
        });
    }

    // 检查登录状态
    checkAuthStatus() {
        // 检查URL hash中是否有token信息（OAuth回调）
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        if (params.has('access_token')) {
            const accessToken = params.get('access_token');
            const userId = params.get('user_id');
            const expiresIn = params.get('expires_in');
            
            // 保存token信息
            localStorage.setItem('bgm_access_token', accessToken);
            localStorage.setItem('bgm_user_id', userId);
            localStorage.setItem('bgm_token_expires', Date.now() + (expiresIn * 1000));
            
            // 清除URL hash
            window.location.hash = '';
            
            console.log('登录成功，获取用户信息...');
            this.getUserInfo();
        } else {
            // 检查本地存储的token
            const storedToken = localStorage.getItem('bgm_access_token');
            const tokenExpires = localStorage.getItem('bgm_token_expires');
            
            if (storedToken && tokenExpires && Date.now() < parseInt(tokenExpires)) {
                this.accessToken = storedToken;
                this.getUserInfo();
            }
        }
    }

    // 登录
    login() {
        // 使用环境变量或默认的客户端ID
        const BGM_CLIENT_ID = '${BGM_CLIENT_ID}'; // 服务器端会替换这个值
        const redirectUri = window.location.origin + '/api/auth/bangumi/callback';
        const authUrl = `https://bgm.tv/oauth/authorize?client_id=${BGM_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        window.location.href = authUrl;
    }

    // 登出
    logout() {
        localStorage.removeItem('bgm_access_token');
        localStorage.removeItem('bgm_user_id');
        localStorage.removeItem('bgm_token_expires');
        this.accessToken = null;
        this.updateLoginStatus(false);
    }

    // 获取用户信息
    async getUserInfo() {
        const token = localStorage.getItem('bgm_access_token');
        if (!token) return;

        try {
            const response = await fetch('https://api.bgm.tv/v0/me', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'BangumiRandomPicker/1.0'
                }
            });

            if (response.ok) {
                const userInfo = await response.json();
                this.accessToken = token;
                this.username = userInfo.username || null;
                if (this.username) {
                    localStorage.setItem('bgm_username', this.username);
                }
                this.updateLoginStatus(true, userInfo.nickname || userInfo.username);
            } else {
                throw new Error('获取用户信息失败');
            }
        } catch (error) {
            console.error('获取用户信息失败:', error);
            this.logout();
        }
    }

    // 更新登录状态显示
    updateLoginStatus(isLoggedIn, username = '') {
        const loginArea = document.getElementById('bangumi-login-area');
        const userInfo = document.getElementById('bangumi-user-info');
        const usernameSpan = document.getElementById('bangumi-username');

        if (isLoggedIn) {
            loginArea.style.display = 'none';
            userInfo.style.display = 'flex';
            usernameSpan.textContent = username;
        } else {
            loginArea.style.display = 'flex';
            userInfo.style.display = 'none';
        }
    }

    // 一键导入：将账号的“想玩”游戏导入自定义池
    async importWishGamesToPool() {
        if (!this.accessToken) {
            this.showError('请先登录 Bangumi 账号再导入想玩清单');
            return;
        }

        if (!this.username) {
            this.username = localStorage.getItem('bgm_username') || null;
        }

        if (!this.username) {
            try {
                await this.getUserInfo();
            } catch (_) {}
        }

        if (!this.username) {
            this.showError('无法获取用户名，稍后再试或重新登录');
            return;
        }

        const importButton = document.getElementById('import-wish-btn');
        if (importButton) importButton.disabled = true;
        this.showLoading(true);
        this.hideError();

        try {
            const wishSubjects = await this.fetchAllWishGames(this.username);

            if (!wishSubjects || wishSubjects.length === 0) {
                this.showError('未在账号中找到标记为“想玩”的游戏');
                return;
            }

            // 去重：避免与自定义池和当前目录重复
            const existingIds = new Set([
                ...this.customGamePool.map(g => g.id),
                ...this.currentIndexItems.map(g => g.id)
            ]);

            let addedCount = 0;
            for (const subject of wishSubjects) {
                if (!subject || !subject.id || existingIds.has(subject.id)) continue;
                this.customGamePool.push({
                    id: subject.id,
                    name: subject.name,
                    name_cn: subject.name_cn,
                    date: subject.date,
                    images: subject.images,
                    type: 4
                });
                existingIds.add(subject.id);
                addedCount++;
            }

            if (addedCount > 0) {
                this.saveCustomPool();
                this.updatePoolStatus();
            }

            const skippedCount = wishSubjects.length - addedCount;
            const msg = `导入完成：新增 ${addedCount} 个，跳过 ${skippedCount} 个已存在的游戏`;
            this.showError(msg);
        } catch (error) {
            console.error('导入想玩清单失败:', error);
            this.showError(error.message || '导入失败，请稍后重试');
        } finally {
            this.showLoading(false);
            if (importButton) importButton.disabled = false;
        }
    }

    // 分页拉取“想玩”游戏（type=wish，subject_type=4），尽量返回完整 subject 数据
    async fetchAllWishGames(username) {
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'User-Agent': 'BangumiRandomPicker/1.0'
        };

        const limit = 100;
        let offset = 0;
        const collectedSubjects = [];

        while (true) {
            const url = `https://api.bgm.tv/v0/users/${encodeURIComponent(username)}/collections?subject_type=4&type=wish&limit=${limit}&offset=${offset}`;
            const response = await fetch(url, { headers });

            if (!response.ok) {
                // 尝试兼容整数枚举（部分实现可能使用 type=2 表示 wish）
                if (response.status === 400 || response.status === 422) {
                    const fallbackUrl = `https://api.bgm.tv/v0/users/${encodeURIComponent(username)}/collections?subject_type=4&type=1&limit=${limit}&offset=${offset}`;
                    const fallbackResp = await fetch(fallbackUrl, { headers });
                    if (!fallbackResp.ok) {
                        throw new Error(`获取想玩清单失败（HTTP ${fallbackResp.status}）`);
                    }
                    const fallbackData = await fallbackResp.json();
                    const pageItems = fallbackData.data || [];
                    this.extractSubjectsFromCollections(pageItems, collectedSubjects);
                    if (pageItems.length < limit) break;
                    offset += limit;
                    continue;
                }
                throw new Error(`获取想玩清单失败（HTTP ${response.status}）`);
            }

            const data = await response.json();
            const pageItems = data.data || [];
            this.extractSubjectsFromCollections(pageItems, collectedSubjects);

            if (pageItems.length < limit) break;
            offset += limit;
        }

        // 补全缺失详细信息
        const subjectsNeedingDetails = collectedSubjects.filter(s => !s.images || !s.date || !s.name);
        if (subjectsNeedingDetails.length > 0) {
            const detailedMap = await this.fetchSubjectDetailsInBatches(subjectsNeedingDetails.map(s => s.id));
            for (let i = 0; i < collectedSubjects.length; i++) {
                const s = collectedSubjects[i];
                if (detailedMap.has(s.id)) {
                    collectedSubjects[i] = detailedMap.get(s.id);
                }
            }
        }

        // 仅保留游戏类型
        return collectedSubjects.filter(s => s && (s.type === 4 || s.type === '4'));
    }

    // 从收藏条目中抽取 subject 基本信息
    extractSubjectsFromCollections(collectionItems, outSubjects) {
        for (const item of collectionItems) {
            const subject = item.subject || null;
            if (subject && (subject.type === 4 || subject.type === '4')) {
                outSubjects.push({
                    id: subject.id,
                    name: subject.name,
                    name_cn: subject.name_cn,
                    date: subject.date,
                    images: subject.images,
                    type: 4
                });
            } else if (item.subject_id) {
                outSubjects.push({ id: item.subject_id, type: 4 });
            }
        }
    }

    // 批量获取条目详情，限制并发，返回 Map<id, subject>
    async fetchSubjectDetailsInBatches(subjectIds) {
        const headers = {
            'User-Agent': 'BangumiRandomPicker/1.0'
        };
        if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

        const resultMap = new Map();
        const batchSize = 5;
        for (let i = 0; i < subjectIds.length; i += batchSize) {
            const batch = subjectIds.slice(i, i + batchSize);
            const promises = batch.map(async (id) => {
                try {
                    const resp = await fetch(`https://api.bgm.tv/v0/subjects/${id}`, { headers });
                    if (resp.ok) {
                        const data = await resp.json();
                        resultMap.set(id, {
                            id: data.id,
                            name: data.name,
                            name_cn: data.name_cn,
                            date: data.date,
                            images: data.images,
                            type: 4
                        });
                    }
                } catch (_) {}
            });
            await Promise.all(promises);
            if (i + batchSize < subjectIds.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }
        return resultMap;
    }

    // 搜索目录
    async searchIndex() {
        const searchInput = document.getElementById('index-search-input');
        const searchTerm = searchInput.value.trim();
        
        if (!searchTerm) {
            this.showError('请输入目录ID或搜索关键词');
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            // 如果输入的是纯数字，视为目录ID
            if (/^\d+$/.test(searchTerm)) {
                await this.loadIndexById(searchTerm);
            } else {
                // 关键词搜索功能暂未实现
                this.showError('请输入数字形式的目录ID（如：12345）');
            }
        } catch (error) {
            console.error('搜索目录失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 通过ID加载目录
    async loadIndexById(indexId) {
        try {
            // 准备请求头
            const headers = {
                'User-Agent': 'BangumiRandomPicker/1.0'
            };
            
            // 如果用户已登录，添加认证头
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }
            
            // 获取目录基本信息
            const indexResponse = await fetch(`https://api.bgm.tv/v0/indices/${indexId}`, {
                headers: headers
            });

            if (!indexResponse.ok) {
                if (indexResponse.status === 404) {
                    throw new Error(`目录 ${indexId} 不存在`);
                } else if (indexResponse.status === 401 || indexResponse.status === 403) {
                    throw new Error(`目录 ${indexId} 需要登录才能访问，请先登录Bangumi账号`);
                } else {
                    throw new Error(`无法访问目录 ${indexId}（HTTP ${indexResponse.status}）`);
                }
            }

            const indexData = await indexResponse.json();
            
            // 获取目录中的所有作品列表（支持分页）
            let allSubjects = [];
            let offset = 0;
            const limit = 100; // 每次获取100个项目，提高效率
            
            while (true) {
                const subjectsResponse = await fetch(
                    `https://api.bgm.tv/v0/indices/${indexId}/subjects?limit=${limit}&offset=${offset}`,
                    { headers: headers }
                );

                if (!subjectsResponse.ok) {
                    if (subjectsResponse.status === 401 || subjectsResponse.status === 403) {
                        throw new Error('目录作品列表需要登录才能访问，请先登录Bangumi账号');
                    } else {
                        throw new Error(`无法获取目录作品列表（HTTP ${subjectsResponse.status}）`);
                    }
                }

                const subjectsData = await subjectsResponse.json();
                const subjects = subjectsData.data || [];
                
                if (subjects.length === 0) {
                    break; // 没有更多数据了
                }
                
                allSubjects = allSubjects.concat(subjects);
                
                // 如果返回的数据少于请求的数量，说明是最后一页
                if (subjects.length < limit) {
                    break;
                }
                
                offset += limit;
            }
            
            // 筛选出游戏类型的作品（type = 4）
            const gameSubjects = allSubjects.filter(item => item.type === 4);
            
            if (gameSubjects.length === 0) {
                throw new Error('该目录中没有找到游戏作品');
            }

            this.currentIndex = indexData;
            this.currentIndexItems = gameSubjects;
            this.displayIndexInfo(indexData, gameSubjects.length);
            
        } catch (error) {
            throw error;
        }
    }

    // 显示目录信息
    displayIndexInfo(indexData, gameCount) {
        const section = document.getElementById('index-info-section');
        const title = document.getElementById('index-title');
        const description = document.getElementById('index-description');
        const total = document.getElementById('index-total');
        const creator = document.getElementById('index-creator');

        title.textContent = indexData.title;
        description.textContent = indexData.desc || '暂无描述';
        total.textContent = `共 ${gameCount} 个游戏作品`;
        creator.textContent = `创建者：${indexData.creator?.nickname || indexData.creator?.username || '未知'}`;

        section.style.display = 'block';
        document.getElementById('result-section').style.display = 'none';
        this.updatePoolStatus();
    }

    // 更新游戏池状态显示
    updatePoolStatus() {
        const poolSection = document.getElementById('pool-status-section');
        const indexCount = document.getElementById('index-games-count');
        const customCount = document.getElementById('custom-games-count');
        const totalCount = document.getElementById('total-games-count');
        
        const indexGames = this.currentIndexItems.length;
        const customGames = this.customGamePool.length;
        const total = indexGames + customGames;
        
        indexCount.textContent = indexGames;
        customCount.textContent = customGames;
        totalCount.textContent = total;

        // 改为始终显示抽取池状态区域
        if (poolSection) {
            poolSection.style.display = 'block';
        }
    }

    // 随机抽取作品
    // 随机抽取作品
    // 随机抽取作品
    // 随机抽取作品
    async randomPick() {
        // 合并目录游戏和自定义游戏池
        let allGames = [...this.currentIndexItems, ...this.customGamePool];
        const totalGames = allGames.length;
        
        // 如果有评分筛选条件，需要先获取详细信息进行筛选
        if (this.filters.ratingRange.min || this.filters.ratingRange.max) {
            this.showLoading(true);
            allGames = await this.filterGamesByRating(allGames);
            this.showLoading(false);
        } else {
            // 应用基础筛选条件（年份等）
            allGames = allGames.filter(game => this.passesFilters(game));
        }
        
        const filteredGames = allGames.length;
        
        // 如果启用了排除历史记录选项，过滤掉已抽取的游戏
        if (this.excludeHistory && this.pickHistory.length > 0) {
            const historyIds = new Set(this.pickHistory.map(item => item.id));
            allGames = allGames.filter(game => !historyIds.has(game.id));
        }
        
        const finalGames = allGames.length;
        
        if (finalGames === 0) {
            let errorMsg = '';
            if (totalGames === 0) {
                errorMsg = '请先搜索目录或添加自定义游戏';
            } else if (filteredGames === 0) {
                errorMsg = `没有符合筛选条件的游戏（总共${totalGames}个游戏，筛选后0个）。请调整筛选条件`;
            } else if (this.excludeHistory && this.pickHistory.length > 0) {
                errorMsg = `所有符合条件的游戏都已被抽取过（筛选后${filteredGames}个，排除历史后0个）。请关闭"排除已抽取"选项或清空历史记录`;
            } else {
                errorMsg = '没有可抽取的游戏';
            }
            this.showError(errorMsg);
            return;
        }

        this.showLoading(true);
        this.showLoading(true);
        document.getElementById('random-pick-btn').disabled = true;

        try {
            // 随机选择一个作品
            const randomIndex = Math.floor(Math.random() * allGames.length);
            const selectedItem = allGames[randomIndex];

            let subjectData;
            
            // 如果游戏已经有详细数据（来自评分筛选），直接使用
            if (selectedItem.detailedData) {
                subjectData = selectedItem.detailedData;
            } else {
                // 获取作品详细信息
                const headers = {
                    'User-Agent': 'BangumiRandomPicker/1.0'
                };
                
                // 如果用户已登录，添加认证头
                if (this.accessToken) {
                    headers['Authorization'] = `Bearer ${this.accessToken}`;
                }
                
                const subjectResponse = await fetch(`https://api.bgm.tv/v0/subjects/${selectedItem.id}`, {
                    headers: headers
                });

                if (!subjectResponse.ok) {
                    if (subjectResponse.status === 404) {
                        throw new Error(`作品 ${selectedItem.id} 不存在`);
                    } else if (subjectResponse.status === 401 || subjectResponse.status === 403) {
                        throw new Error(`作品 ${selectedItem.name || selectedItem.id} 需要登录才能访问，请先登录Bangumi账号`);
                    } else {
                        throw new Error(`无法获取作品详细信息（HTTP ${subjectResponse.status}）`);
                    }
                }

                subjectData = await subjectResponse.json();
            }
            
            // 添加到抽取历史
            this.addToHistory(subjectData);
            
            this.displayResult(selectedItem, subjectData);

        } catch (error) {
            console.error('随机抽取失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
            document.getElementById('random-pick-btn').disabled = false;
        }
    }

    // 添加到抽取历史
    addToHistory(subjectData) {
        const historyItem = {
            id: subjectData.id,
            name: subjectData.name,
            name_cn: subjectData.name_cn,
            date: subjectData.date,
            images: subjectData.images,
            pickTime: Date.now()
        };
        
        // 避免重复添加（检查最近的记录）
        if (this.pickHistory.length === 0 || this.pickHistory[this.pickHistory.length - 1].id !== subjectData.id) {
            this.pickHistory.push(historyItem);
            
            // 限制历史记录数量（最多保存100条）
            if (this.pickHistory.length > 100) {
                this.pickHistory.shift();
            }
            
            this.savePickHistory();
        }
    }

    // 显示抽取结果
    // 显示抽取结果
    displayResult(indexItem, subjectData) {
        const section = document.getElementById('result-section');
        const image = document.getElementById('result-image');
        const title = document.getElementById('result-title');
        const rating = document.getElementById('result-rating');
        const name = document.getElementById('result-name');
        const date = document.getElementById('result-date');
        const comment = document.getElementById('result-comment');
        const visitBtn = document.getElementById('visit-bangumi-btn');

        // 设置图片
        const imageUrl = subjectData.images?.large || subjectData.images?.common || subjectData.images?.medium;
        if (imageUrl) {
            image.src = imageUrl;
            image.alt = subjectData.name;
        } else {
            image.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgdmlld0JveD0iMCAwIDIwMCAyODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjgwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMDAgMTQwTDEyMCAxMjBMMTIwIDEwMEgxNDBWMTIwTDE2MCAxNDBMMTQwIDE2MFYxODBIMTIwTDEwMCAxNjBMMTIwIDE0MEgxMDBaIiBmaWxsPSIjQ0NDQ0NDIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMjAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiPuaXoOWbvuWDjzwvdGV4dD4KPC9zdmc+';
            image.alt = '无图片';
        }

        // 设置信息
        title.textContent = subjectData.name_cn || subjectData.name;
        
        // 显示评分信息
        if (subjectData.rating && subjectData.rating.score && subjectData.rating.score > 0) {
            const score = subjectData.rating.score;
            const total = subjectData.rating.total || 0;
            rating.textContent = `⭐ 评分: ${score}/10 (${total}人评价)`;
            rating.style.display = 'block';
        } else {
            rating.style.display = 'none';
        }
        
        name.textContent = `原名: ${subjectData.name}`;
        date.textContent = `发行日期: ${subjectData.date || '未知'}`;
        comment.textContent = indexItem.comment ? `收录备注: ${indexItem.comment}` : '';

        visitBtn.onclick = () => {
            window.open(`https://bgm.tv/subject/${subjectData.id}`, '_blank');
        };

        section.style.display = 'block';
        
        // 滚动到结果区域
        section.scrollIntoView({ behavior: 'smooth' });
    }

    // 访问Bangumi页面
    visitBangumiPage() {
        if (this.currentResult) {
            window.open(`https://bgm.tv/subject/${this.currentResult.id}`, '_blank');
        }
    }

    // 显示/隐藏加载状态
    showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'block' : 'none';
    }

    // 显示错误信息
    showError(message) {
        const errorDiv = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        errorText.textContent = message;
        errorDiv.style.display = 'flex';
    }

    // 隐藏错误信息
    hideError() {
        const errorDiv = document.getElementById('error-message');
        errorDiv.style.display = 'none';
    }

    // 搜索游戏
    async searchGames() {
        const searchInput = document.getElementById('game-search-input');
        const keyword = searchInput.value.trim();
        
        if (!keyword) {
            this.showError('请输入游戏名称');
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'BangumiRandomPicker/1.0'
            };
            
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const requestBody = {
                keyword: keyword,
                filter: {
                    type: [4]  // 游戏类型
                },
                sort: "match"
            };

            const response = await fetch('https://api.bgm.tv/v0/search/subjects', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`搜索失败（HTTP ${response.status}）`);
            }

            const data = await response.json();
            this.displayGameSearchResults(data.data || []);

        } catch (error) {
            console.error('游戏搜索失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 显示游戏搜索结果
    displayGameSearchResults(games) {
        const resultsDiv = document.getElementById('game-search-results');
        
        if (games.length === 0) {
            resultsDiv.innerHTML = '<p style="color: rgba(255, 255, 255, 0.6); text-align: center; padding: 20px;">未找到相关游戏</p>';
            resultsDiv.style.display = 'block';
            return;
        }

        const resultsHtml = games.map(game => {
            const isAdded = this.customGamePool.some(item => item.id === game.id);
            const imageUrl = game.images?.large || game.images?.common || game.images?.medium || '';
            
            return `
                <div class="search-result-item">
                    <img class="search-result-image" src="${imageUrl}" alt="${game.name}" 
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iODQiIHZpZXdCb3g9IjAgMCA2MCA4NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9Ijg0IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMCA0MkwzNiAzNkwzNiAzMEg0MlYzNkw0OCA0Mkw0MiA0OFY1NEgzNkwzMCA0OEwzNiA0Mkg0MloiIGZpbGw9IiNDQ0NDQ0MiLz4KPHR4dCB4PSIzMCIgeT0iNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4IiBmaWxsPSIjOTk5OTk5Ij7ml6Dlm77lg488L3R4dD4KPC9zdmc+'" />
                    <div class="search-result-info">
                        <div class="search-result-title">${game.name_cn || game.name}</div>
                        <div class="search-result-name">原名: ${game.name}</div>
                        <div class="search-result-date">发行日期: ${game.date || '未知'}</div>
                    </div>
                    <button class="add-to-pool-btn" 
                            onclick="window.app.addToCustomPool(${game.id})" 
                            ${isAdded ? 'disabled' : ''}>
                        ${isAdded ? '已添加' : '添加到池'}
                    </button>
                </div>
            `;
        }).join('');

        resultsDiv.innerHTML = resultsHtml;
        resultsDiv.style.display = 'block';
    }

    // 添加游戏到自定义池
    async addToCustomPool(gameId) {
        // 检查是否已存在
        if (this.customGamePool.some(item => item.id === gameId)) {
            this.showError('该游戏已在自定义池中');
            return;
        }

        this.showLoading(true);

        try {
            const headers = {
                'User-Agent': 'BangumiRandomPicker/1.0'
            };
            
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            const response = await fetch(`https://api.bgm.tv/v0/subjects/${gameId}`, {
                headers: headers
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`游戏 ${gameId} 不存在`);
                } else if (response.status === 401 || response.status === 403) {
                    throw new Error(`该游戏需要登录才能访问，请先登录Bangumi账号`);
                } else {
                    throw new Error(`无法获取游戏信息（HTTP ${response.status}）`);
                }
            }

            const gameData = await response.json();
            
            // 添加到自定义池
            this.customGamePool.push({
                id: gameData.id,
                name: gameData.name,
                name_cn: gameData.name_cn,
                date: gameData.date,
                images: gameData.images,
                type: 4 // 确保是游戏类型
            });

            this.saveCustomPool(); // 保存到localStorage
            this.updatePoolStatus();
            
            // 重新显示搜索结果以更新按钮状态
            const keyword = document.getElementById('game-search-input').value.trim();
            if (keyword) {
                this.searchGames();
            }

        } catch (error) {
            console.error('添加游戏失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // 查看自定义游戏池
    viewCustomPool() {
        const modal = document.getElementById('custom-pool-modal');
        const listDiv = document.getElementById('custom-pool-list');
        const emptyDiv = document.getElementById('custom-pool-empty');

        if (this.customGamePool.length === 0) {
            listDiv.style.display = 'none';
            emptyDiv.style.display = 'block';
        } else {
            const poolHtml = this.customGamePool.map(game => {
                const imageUrl = game.images?.large || game.images?.common || game.images?.medium || '';
                
                return `
                    <div class="custom-pool-item">
                        <img class="custom-pool-item-image" src="${imageUrl}" alt="${game.name}" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNzAiIHZpZXdCb3g9IjAgMCA1MCA3MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjcwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yNSAzNUwzMCAzMEwzMCAyNUgzNVYzMEw0MCAzNUwzNSA0MFY0NUgzMEwyNSA0MEwzMCAzNUgzNVoiIGZpbGw9IiNDQ0NDQ0MiLz4KPHR4dCB4PSIyNSIgeT0iNTUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI3IiBmaWxsPSIjOTk5OTk5Ij7ml6Dlm77lg488L3R4dD4KPC9zdmc+'" />
                        <div class="custom-pool-item-info">
                            <div class="custom-pool-item-title">${game.name_cn || game.name}</div>
                            <div class="custom-pool-item-name">原名: ${game.name}</div>
                        </div>
                        <button class="remove-from-pool-btn" onclick="window.app.removeFromCustomPool(${game.id})">
                            移除
                        </button>
                    </div>
                `;
            }).join('');

            listDiv.innerHTML = poolHtml;
            listDiv.style.display = 'block';
            emptyDiv.style.display = 'none';
        }

        modal.style.display = 'flex';
    }

    // 从自定义池移除游戏
    removeFromCustomPool(gameId) {
        this.customGamePool = this.customGamePool.filter(game => game.id !== gameId);
        this.saveCustomPool(); // 保存到localStorage
        this.updatePoolStatus();
        this.viewCustomPool(); // 刷新模态框显示
    }

    // 清空自定义游戏池
    clearCustomPool() {
        if (this.customGamePool.length === 0) {
            this.showError('自定义游戏池已为空');
            return;
        }

        if (confirm(`确定要清空自定义游戏池吗？这将移除所有 ${this.customGamePool.length} 个游戏。`)) {
            this.customGamePool = [];
            this.saveCustomPool(); // 保存到localStorage
            this.updatePoolStatus();
            this.closeCustomPoolModal();
        }
    }

    // 关闭自定义池模态框
    closeCustomPoolModal() {
        document.getElementById('custom-pool-modal').style.display = 'none';
    }

    // 加载保存的自定义游戏池
    loadCustomPool() {
        try {
            const saved = localStorage.getItem('custom_game_pool');
            if (saved) {
                this.customGamePool = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('加载自定义游戏池失败:', error);
            this.customGamePool = [];
        }
    }

    // 保存自定义游戏池到localStorage
    saveCustomPool() {
        try {
            localStorage.setItem('custom_game_pool', JSON.stringify(this.customGamePool));
        } catch (error) {
            console.warn('保存自定义游戏池失败:', error);
        }
    }

    // 加载抽取历史记录
    loadPickHistory() {
        try {
            const saved = localStorage.getItem('pick_history');
            if (saved) {
                this.pickHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('加载抽取历史失败:', error);
            this.pickHistory = [];
        }
    }

    // 保存抽取历史记录
    savePickHistory() {
        try {
            localStorage.setItem('pick_history', JSON.stringify(this.pickHistory));
        } catch (error) {
            console.warn('保存抽取历史失败:', error);
        }
    }

    // 加载设置
    loadSettings() {
        try {
            const settings = localStorage.getItem('app_settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                this.excludeHistory = parsed.excludeHistory || false;
                this.darkMode = parsed.darkMode || false;
                this.theme = parsed.theme || 'default';
                this.filters = parsed.filters || {
                    yearRange: { min: null, max: null },
                    ratingRange: { min: null, max: null }
                };
                
                // 应用深色模式
                if (this.darkMode) {
                    document.body.classList.add('dark-mode');
                }
                // 应用主题
                this.applyTheme(this.theme);
                
                // 更新UI状态
                const excludeCheckbox = document.getElementById('exclude-history-checkbox');
                if (excludeCheckbox) {
                    excludeCheckbox.checked = this.excludeHistory;
                }
            }
        } catch (error) {
            console.warn('加载设置失败:', error);
        }
    }

    // 保存设置
    saveSettings() {
        try {
            const settings = {
                excludeHistory: this.excludeHistory,
                darkMode: this.darkMode,
                theme: this.theme,
                filters: this.filters
            };
            localStorage.setItem('app_settings', JSON.stringify(settings));
        } catch (error) {
            console.warn('保存设置失败:', error);
        }
    }

    // 切换深色模式
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.body.classList.toggle('dark-mode', this.darkMode);
        this.saveSettings();
    }

    // 切换主题（循环）
    toggleTheme() {
        const themes = ['default', 'sunset', 'forest', 'ocean'];
        const currentIndex = themes.indexOf(this.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.applyTheme(themes[nextIndex]);
        this.saveSettings();
        // 可选反馈
        // this.showError(`主题已切换为：${this.theme}`);
    }

    // 应用指定主题
    applyTheme(themeName) {
        const themes = ['sunset', 'forest', 'ocean'];
        // 移除旧主题类
        for (const t of themes) {
            document.body.classList.remove(`theme-${t}`);
        }
        // 默认主题不加类名
        if (themeName && themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }
        this.theme = themeName || 'default';
    }

    // 查看抽取历史
    viewHistory() {
        const modal = document.getElementById('history-modal');
        const listDiv = document.getElementById('history-list');
        const emptyDiv = document.getElementById('history-empty');

        if (this.pickHistory.length === 0) {
            listDiv.style.display = 'none';
            emptyDiv.style.display = 'block';
        } else {
            const historyHtml = this.pickHistory.slice().reverse().map((item, index) => {
                const imageUrl = item.images?.large || item.images?.common || item.images?.medium || '';
                const pickTime = new Date(item.pickTime).toLocaleString('zh-CN');
                
                return `
                    <div class="history-item">
                        <img class="history-item-image" src="${imageUrl}" alt="${item.name}" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNzAiIHZpZXdCb3g9IjAgMCA1MCA3MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjcwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yNSAzNUwzMCAzMEwzMCAyNUgzNVYzMEw0MCAzNUwzNSA0MFY0NUgzMEwyNSA0MEwzMCAzNUgzNVoiIGZpbGw9IiNDQ0NDQ0MiLz4KPHR4dCB4PSIyNSIgeT0iNTUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI3IiBmaWxsPSIjOTk5OTk5Ij7ml6Dlm77lg488L3R4dD4KPC9zdmc+'" />
                        <div class="history-item-info">
                            <div class="history-item-title">${item.name_cn || item.name}</div>
                            <div class="history-item-name">原名: ${item.name}</div>
                            <div class="history-item-date">发行日期: ${item.date || '未知'}</div>
                            <div class="history-item-time">抽取时间: ${pickTime}</div>
                        </div>
                        <div class="history-item-actions">
                            <button class="visit-game-btn" onclick="window.open('https://bgm.tv/subject/${item.id}', '_blank')">
                                访问页面
                            </button>
                            <button class="remove-history-btn" onclick="window.app.removeFromHistory(${index})">
                                移除
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            listDiv.innerHTML = historyHtml;
            listDiv.style.display = 'block';
            emptyDiv.style.display = 'none';
        }

        modal.style.display = 'flex';
    }

    // 从历史记录中移除
    removeFromHistory(reverseIndex) {
        const actualIndex = this.pickHistory.length - 1 - reverseIndex;
        this.pickHistory.splice(actualIndex, 1);
        this.savePickHistory();
        this.viewHistory(); // 刷新显示
    }

    // 清空抽取历史
    clearHistory() {
        if (this.pickHistory.length === 0) {
            this.showError('抽取历史已为空');
            return;
        }

        if (confirm(`确定要清空抽取历史吗？这将移除所有 ${this.pickHistory.length} 条记录。`)) {
            this.pickHistory = [];
            this.savePickHistory();
            this.closeHistoryModal();
        }
    }

    // 关闭历史记录模态框
    // 关闭历史记录模态框
    closeHistoryModal() {
        document.getElementById('history-modal').style.display = 'none';
    }

    // 应用筛选条件
    // 切换筛选区域显示
    toggleFilters() {
        const filterSection = document.getElementById('filter-section');
        const toggleBtn = document.getElementById('toggle-filters-btn');
        
        if (filterSection.style.display === 'none' || filterSection.style.display === '') {
            filterSection.style.display = 'block';
            toggleBtn.textContent = '🔍 隐藏筛选';
            
            // 加载已保存的筛选条件
            if (this.filters.yearRange.min) {
                document.getElementById('year-min').value = this.filters.yearRange.min;
            }
            if (this.filters.yearRange.max) {
                document.getElementById('year-max').value = this.filters.yearRange.max;
            }
            if (this.filters.ratingRange.min) {
                document.getElementById('rating-min').value = this.filters.ratingRange.min;
            }
            if (this.filters.ratingRange.max) {
                document.getElementById('rating-max').value = this.filters.ratingRange.max;
            }
        } else {
            filterSection.style.display = 'none';
            toggleBtn.textContent = '🔍 筛选条件';
        }
    }

    // 应用筛选条件
    // 应用筛选条件
    // 应用筛选条件
    applyFilters() {
        const yearMin = document.getElementById('year-min').value;
        const yearMax = document.getElementById('year-max').value;
        const ratingMin = document.getElementById('rating-min').value;
        const ratingMax = document.getElementById('rating-max').value;

        // 更新筛选条件
        this.filters.yearRange.min = yearMin ? parseInt(yearMin) : null;
        this.filters.yearRange.max = yearMax ? parseInt(yearMax) : null;
        this.filters.ratingRange.min = ratingMin ? parseFloat(ratingMin) : null;
        this.filters.ratingRange.max = ratingMax ? parseFloat(ratingMax) : null;

        this.saveSettings();
        
        let message = '筛选条件已应用！筛选将在下次抽取时生效。';
        if (ratingMin || ratingMax) {
            message += '注意：评分筛选仅对有评分数据的游戏生效，没有评分的游戏将被排除。';
        }
        
        this.showError(message);
    }

    // 清除筛选条件
    // 清除筛选条件
    clearFilters() {
        this.filters = {
            yearRange: { min: null, max: null },
            ratingRange: { min: null, max: null }
        };

        // 清空输入框
        document.getElementById('year-min').value = '';
        document.getElementById('year-max').value = '';
        document.getElementById('rating-min').value = '';
        document.getElementById('rating-max').value = '';

        this.saveSettings();
        
        this.showError('筛选条件已清除');
    }

    // 检查游戏是否符合筛选条件
    // 批量抽取作品
    // 批量抽取作品
    // 批量抽取作品
    async batchPick() {
        const batchCount = parseInt(document.getElementById('batch-count').value) || 3;
        
        if (batchCount < 2 || batchCount > 10) {
            this.showError('批量抽取数量应在2-10之间');
            return;
        }

        this.showLoading(true);
        document.getElementById('batch-pick-btn').disabled = true;
        document.getElementById('random-pick-btn').disabled = true;

        try {
            // 合并目录游戏和自定义游戏池
            let allGames = [...this.currentIndexItems, ...this.customGamePool];
            const totalGames = allGames.length;
            
            // 如果有评分筛选条件，需要先获取详细信息进行筛选
            if (this.filters.ratingRange.min || this.filters.ratingRange.max) {
                allGames = await this.filterGamesByRating(allGames);
            } else {
                // 应用基础筛选条件（年份等）
                allGames = allGames.filter(game => this.passesFilters(game));
            }
            
            const filteredGames = allGames.length;
            
            // 如果启用了排除历史记录选项，过滤掉已抽取的游戏
            if (this.excludeHistory && this.pickHistory.length > 0) {
                const historyIds = new Set(this.pickHistory.map(item => item.id));
                allGames = allGames.filter(game => !historyIds.has(game.id));
            }
            
            const finalGames = allGames.length;
            
            if (finalGames === 0) {
                let errorMsg = '';
                if (totalGames === 0) {
                    errorMsg = '请先搜索目录或添加自定义游戏';
                } else if (filteredGames === 0) {
                    errorMsg = `没有符合筛选条件的游戏（总共${totalGames}个游戏，筛选后0个）。请调整筛选条件`;
                } else if (this.excludeHistory && this.pickHistory.length > 0) {
                    errorMsg = `所有符合条件的游戏都已被抽取过（筛选后${filteredGames}个，排除历史后0个）。请关闭"排除已抽取"选项或清空历史记录`;
                } else {
                    errorMsg = '没有可抽取的游戏';
                }
                this.showError(errorMsg);
                return;
            }

            if (finalGames < batchCount) {
                let errorMsg = `可抽取的游戏数量不足：需要${batchCount}个，但只有${finalGames}个可用`;
                if (totalGames > finalGames) {
                    if (filteredGames < totalGames) {
                        errorMsg += `（总共${totalGames}个游戏，筛选后${filteredGames}个`;
                        if (this.excludeHistory && this.pickHistory.length > 0) {
                            errorMsg += `，排除历史后${finalGames}个`;
                        }
                        errorMsg += '）';
                    } else if (this.excludeHistory && this.pickHistory.length > 0) {
                        errorMsg += `（筛选后${filteredGames}个，排除历史后${finalGames}个）`;
                    }
                    errorMsg += '。请调整筛选条件或关闭"排除已抽取"选项';
                }
                this.showError(errorMsg);
                return;
            }

        this.showLoading(true);
            const selectedGames = [];
            const availableGames = [...allGames];

            // 随机选择指定数量的游戏
            for (let i = 0; i < batchCount; i++) {
                const randomIndex = Math.floor(Math.random() * availableGames.length);
                const selectedGame = availableGames.splice(randomIndex, 1)[0];
                selectedGames.push(selectedGame);
            }

            // 获取所有游戏的详细信息
            const gameDetails = [];
            const headers = {
                'User-Agent': 'BangumiRandomPicker/1.0'
            };
            
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            for (const game of selectedGames) {
                try {
                    // 如果游戏已经有详细数据（来自评分筛选），直接使用
                    if (game.detailedData) {
                        gameDetails.push(game.detailedData);
                        this.addToHistory(game.detailedData);
                        continue;
                    }

                    const response = await fetch(`https://api.bgm.tv/v0/subjects/${game.id}`, {
                        headers: headers
                    });

                    if (response.ok) {
                        const gameData = await response.json();
                        gameDetails.push(gameData);
                        this.addToHistory(gameData);
                    } else {
                        console.warn(`无法获取游戏 ${game.id} 的详细信息`);
                    }
                } catch (error) {
                    console.warn(`获取游戏 ${game.id} 详细信息时出错:`, error);
                }
            }

            if (gameDetails.length > 0) {
                this.displayBatchResults(gameDetails);
            } else {
                throw new Error('无法获取任何游戏的详细信息');
            }

        } catch (error) {
            console.error('批量抽取失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
            document.getElementById('batch-pick-btn').disabled = false;
            document.getElementById('random-pick-btn').disabled = false;
        }
    }

    // 显示批量抽取结果
    // 显示批量抽取结果
    displayBatchResults(gameDetails) {
        const section = document.getElementById('result-section');
        const resultCard = section.querySelector('.result-card');
        
        // 创建批量结果显示
        const batchResultsHtml = `
            <h3>🎲 批量抽取结果 (${gameDetails.length}个游戏)</h3>
            <div class="batch-results">
                ${gameDetails.map(game => {
                    const imageUrl = game.images?.large || game.images?.common || game.images?.medium;
                    
                    // 构建评分信息
                    let ratingHtml = '';
                    if (game.rating && game.rating.score && game.rating.score > 0) {
                        const score = game.rating.score;
                        const total = game.rating.total || 0;
                        ratingHtml = `<p><strong>⭐ 评分:</strong> ${score}/10 (${total}人评价)</p>`;
                    }
                    
                    return `
                        <div class="batch-result-item">
                            <div class="batch-result-image">
                                <img src="${imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDEwMCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik01MCA3MEw2MCA2MEw2MCA1MEg3MFY2MEw4MCA3MEw3MCA4MFY5MEg2MEw1MCA4MEw2MCA3MEg3MFoiIGZpbGw9IiNDQ0NDQ0MiLz4KPHR4dCB4PSI1MCIgeT0iMTEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5OTk5OTkiPuaXoOWbvuWDjzwvdGV4dD4KPC9zdmc+'}" 
                                     alt="${game.name}" />
                            </div>
                            <div class="batch-result-info">
                                <h4>${game.name_cn || game.name}</h4>
                                ${ratingHtml}
                                <p><strong>原名:</strong> ${game.name}</p>
                                <p><strong>发行日期:</strong> ${game.date || '未知'}</p>
                                <div class="batch-result-actions">
                                    <button class="action-btn" onclick="window.open('https://bgm.tv/subject/${game.id}', '_blank')">
                                        访问页面
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="batch-actions">
                <button id="batch-again-btn" class="action-btn" onclick="window.app.batchPick()">🎲 再次批量抽取</button>
                <button id="single-pick-btn" class="action-btn secondary" onclick="window.app.randomPick()">🎯 单个抽取</button>
            </div>
        `;

        resultCard.innerHTML = batchResultsHtml;
        section.style.display = 'block';
        
        // 滚动到结果区域
        section.scrollIntoView({ behavior: 'smooth' });
    }

    // 检查游戏是否符合筛选条件
    // 检查游戏是否符合筛选条件
    // 检查游戏是否符合筛选条件
    // 按评分筛选游戏（需要获取详细信息）
    async filterGamesByRating(games) {
        const headers = {
            'User-Agent': 'BangumiRandomPicker/1.0'
        };
        
        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const filteredGames = [];
        const batchSize = 5; // 每批处理5个游戏，避免请求过于频繁
        
        for (let i = 0; i < games.length; i += batchSize) {
            const batch = games.slice(i, i + batchSize);
            const promises = batch.map(async (game) => {
                try {
                    // 首先检查基础筛选条件（年份等）
                    if (!this.passesBasicFilters(game)) {
                        return null;
                    }

                    const response = await fetch(`https://api.bgm.tv/v0/subjects/${game.id}`, {
                        headers: headers
                    });

                    if (response.ok) {
                        const gameData = await response.json();
                        
                        // 检查评分筛选
                        let rating = null;
                        if (gameData.rating && typeof gameData.rating === 'object') {
                            rating = gameData.rating.score || gameData.rating.total || null;
                        }
                        
                        if (rating !== null && rating > 0) {
                            if (this.filters.ratingRange.min && rating < this.filters.ratingRange.min) {
                                return null;
                            }
                            if (this.filters.ratingRange.max && rating > this.filters.ratingRange.max) {
                                return null;
                            }
                            
                            // 将评分信息添加到游戏对象中，以便后续使用
                            return { ...game, rating: gameData.rating, detailedData: gameData };
                        }
                    }
                } catch (error) {
                    console.warn(`获取游戏 ${game.id} 详细信息失败:`, error);
                }
                return null;
            });

            const batchResults = await Promise.all(promises);
            filteredGames.push(...batchResults.filter(game => game !== null));
            
            // 添加延迟避免请求过于频繁
            if (i + batchSize < games.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return filteredGames;
    }

    // 检查基础筛选条件（不包括评分）
    passesBasicFilters(game) {
        // 年份筛选
        if (this.filters.yearRange.min || this.filters.yearRange.max) {
            const gameYear = game.date ? parseInt(game.date.split('-')[0]) : null;
            if (gameYear) {
                if (this.filters.yearRange.min && gameYear < this.filters.yearRange.min) {
                    return false;
                }
                if (this.filters.yearRange.max && gameYear > this.filters.yearRange.max) {
                    return false;
                }
            } else if (this.filters.yearRange.min || this.filters.yearRange.max) {
                // 如果设置了年份筛选但游戏没有年份信息，则排除
                return false;
            }
        }

        return true;
    }

    // 检查游戏是否符合筛选条件
    passesFilters(game) {
        // 年份筛选
        if (this.filters.yearRange.min || this.filters.yearRange.max) {
            const gameYear = game.date ? parseInt(game.date.split('-')[0]) : null;
            if (gameYear) {
                if (this.filters.yearRange.min && gameYear < this.filters.yearRange.min) {
                    return false;
                }
                if (this.filters.yearRange.max && gameYear > this.filters.yearRange.max) {
                    return false;
                }
            } else if (this.filters.yearRange.min || this.filters.yearRange.max) {
                // 如果设置了年份筛选但游戏没有年份信息，则排除
                return false;
            }
        }

        // 评分筛选 - 检查游戏的评分信息
        if (this.filters.ratingRange.min || this.filters.ratingRange.max) {
            // 尝试从不同的字段获取评分
            let rating = null;
            
            // 检查可能的评分字段
            if (game.rating && typeof game.rating === 'object') {
                rating = game.rating.score || game.rating.total || null;
            } else if (typeof game.rating === 'number') {
                rating = game.rating;
            } else if (game.score) {
                rating = game.score;
            }
            
            // 如果有评分筛选条件但游戏没有评分，则排除
            if (rating === null || rating === 0) {
                return false;
            }
            
            // 应用评分筛选
            if (this.filters.ratingRange.min && rating < this.filters.ratingRange.min) {
                return false;
            }
            if (this.filters.ratingRange.max && rating > this.filters.ratingRange.max) {
                return false;
            }
        }

        return true;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BangumiRandomPicker();
});
