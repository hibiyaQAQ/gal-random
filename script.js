// Bangumi目录随机抽取器
class BangumiRandomPicker {
    constructor() {
        this.accessToken = null;
        this.currentIndex = null;
        this.currentIndexItems = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        // 登录相关事件
        document.getElementById('bangumi-login-btn').addEventListener('click', () => this.login());
        document.getElementById('bangumi-logout-btn').addEventListener('click', () => this.logout());
        
        // 搜索相关事件
        document.getElementById('search-btn').addEventListener('click', () => this.searchIndex());
        document.getElementById('index-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchIndex();
            }
        });
        
        // 随机抽取事件
        document.getElementById('random-pick-btn').addEventListener('click', () => this.randomPick());
        document.getElementById('random-again-btn').addEventListener('click', () => this.randomPick());
        
        // 其他事件
        document.getElementById('visit-bangumi-btn').addEventListener('click', () => this.visitBangumiPage());
        document.getElementById('error-close-btn').addEventListener('click', () => this.hideError());
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
    }

    // 随机抽取作品
    async randomPick() {
        if (!this.currentIndexItems || this.currentIndexItems.length === 0) {
            this.showError('请先搜索并选择一个目录');
            return;
        }

        this.showLoading(true);
        document.getElementById('random-pick-btn').disabled = true;

        try {
            // 随机选择一个作品
            const randomIndex = Math.floor(Math.random() * this.currentIndexItems.length);
            const selectedItem = this.currentIndexItems[randomIndex];

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

            const subjectData = await subjectResponse.json();
            this.displayResult(selectedItem, subjectData);

        } catch (error) {
            console.error('随机抽取失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
            document.getElementById('random-pick-btn').disabled = false;
        }
    }

    // 显示抽取结果
    displayResult(indexItem, subjectData) {
        const section = document.getElementById('result-section');
        const image = document.getElementById('result-image');
        const title = document.getElementById('result-title');
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
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new BangumiRandomPicker();
});