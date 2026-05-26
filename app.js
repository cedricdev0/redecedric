// ATENÇÃO: COLE A URL DA SUA IMPLANTAÇÃO DO APPS SCRIPT ENTRE AS ASPAS ABAIXO:
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyxAtxFq7o6YEwVwjw7194KY86tonXZGZ73hiqNSZDPaI_VgFo6M9XGyKiYPCuCB8dXMQ/exec";

// Estados globais do App local
let currentUser = JSON.parse(localStorage.getItem('social_user')) || null;
let activeRecipientId = null;
let dmsPolling = null;
let feedPolling = null;

// Elementos de controle de tela (DOM)
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const navButtons = document.querySelectorAll('.nav-btn');
const subviews = document.querySelectorAll('.subview');

// Ciclo de inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
});

// FORMULÁRIO DE LOGIN / REGISTRO
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim().toLowerCase().replace('@', '');
    const email = document.getElementById('login-email').value.trim();
    const bio = document.getElementById('login-bio').value.trim();
    const avatarUrl = document.getElementById('login-avatar').value.trim(); // Nova captura da foto de perfil

    if (!username || !email) return alert("Preencha o nome de usuário e e-mail!");

    const btn = loginForm.querySelector('button');
    btn.disabled = true;
    btn.innerText = "Conectando ao Sheets...";

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'register', username, email, bio, avatarUrl }) // Enviando a URL do avatar
        });
        
        const result = await response.json();
        
        if (result.success && result.user) {
            currentUser = result.user;
            localStorage.setItem('social_user', JSON.stringify(currentUser));
            showApp();
        } else {
            alert("Erro: " + (result.error || "Não foi possível conectar."));
        }
    } catch (error) {
        console.error(error);
        alert("Erro crítico de conexão com a API.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Entrar / Registrar";
    }
});

// BOTÃO DESCONECTAR
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('social_user');
    currentUser = null;
    clearInterval(dmsPolling);
    clearInterval(feedPolling);
    showLogin();
});

// NAVEGAÇÃO ENTRE ABAS
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        subviews.forEach(s => s.classList.add('hidden'));

        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        document.getElementById(target).classList.remove('hidden');

        // Limpa updates em segundo plano antigos
        clearInterval(dmsPolling);
        clearInterval(feedPolling);
        
        if (target === 'feed-subview') {
            loadFeed();
            feedPolling = setInterval(loadFeed, 8000); 
        } else if (target === 'explore-subview') {
            loadExplore(); // Carrega a nova aba Explorar
        } else if (target === 'dms-subview') {
            loadUsersForDMs();
        } else if (target === 'profile-subview') {
            loadMyProfile();
        }
    });
});

function showLogin() {
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
}

function showApp() {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    document.getElementById('user-display-name').innerText = `@${currentUser.username}`;
    document.querySelector('[data-target="feed-subview"]').click();
}

// ================= SISTEMA DE FEED =================

document.getElementById('submit-post-btn').addEventListener('click', async () => {
    const inputContent = document.getElementById('post-content');
    const inputImage = document.getElementById('post-image-url');
    
    const content = inputContent.value.trim();
    const imageUrl = inputImage.value.trim(); // Nova captura da imagem do post

    if (!content && !imageUrl) return; // Permite postar se houver apenas texto ou apenas imagem

    const btn = document.getElementById('submit-post-btn');
    btn.disabled = true;

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'createPost', userId: currentUser.id, content, imageUrl }) // Enviando a imagem
        });
        const result = await response.json();
        if (result.success) {
            inputContent.value = '';
            inputImage.value = ''; // Limpa o campo da imagem
            loadFeed();
        }
    } catch (error) {
        console.error(error);
    } finally {
        btn.disabled = false;
    }
});

async function loadFeed() {
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getFeed`);
        const posts = await response.json();
        const container = document.getElementById('posts-container');
        container.innerHTML = '';

        if(posts.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">Nenhum post no feed ainda...</p>';
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            
            // Verifica se tem avatar, se não tiver coloca um genérico
            const avatarSrc = post.userAvatar ? post.userAvatar : 'https://via.placeholder.com/40/334155/f8fafc?text=User';
            // Verifica se tem imagem anexada no post
            const imageTag = post.imageUrl ? `<img src="${post.imageUrl}" class="post-attached-image" alt="Imagem do post">` : '';

            card.innerHTML = `
                <div class="post-header">
                    <img src="${avatarSrc}" class="avatar-img" alt="Avatar">
                    <div class="post-header-info">
                        <span class="post-user">@${post.username}</span>
                        <span class="post-date">${new Date(post.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <div class="post-content">${cleanXSS(post.content)}</div>
                ${imageTag}
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error(error);
    }
}

// ================= SISTEMA DE EXPLORAR =================

async function loadExplore() {
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getExplore`);
        const posts = await response.json();
        const container = document.getElementById('explore-container');
        container.innerHTML = '';

        if(posts.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);">Nenhuma imagem encontrada na rede ainda.</p>';
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'explore-item';
            card.innerHTML = `
                <img src="${post.imageUrl}" alt="Explore Image">
                <div class="explore-item-info">@${post.username}</div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error(error);
    }
}

// ================= SISTEMA DE PERFIL =================

async function loadMyProfile() {
    document.getElementById('profile-name').innerText = `@${currentUser.username}`;
    document.getElementById('profile-bio').innerText = currentUser.bio || "Nenhuma biografia definida ainda.";

    try {
        const response = await fetch(`${WEB_APP_URL}?action=getFeed`);
        const posts = await response.json();
        const container = document.getElementById('my-posts-container');
        container.innerHTML = '';

        const myPosts = posts.filter(p => p.userId === currentUser.id);

        if(myPosts.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);">Você ainda não postou nada.</p>';
            return;
        }

        myPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            
            const avatarSrc = post.userAvatar ? post.userAvatar : 'https://via.placeholder.com/40/334155/f8fafc?text=User';
            const imageTag = post.imageUrl ? `<img src="${post.imageUrl}" class="post-attached-image" alt="Imagem do post">` : '';

            card.innerHTML = `
                <div class="post-header">
                    <img src="${avatarSrc}" class="avatar-img" alt="Avatar">
                    <div class="post-header-info">
                        <span class="post-user">@${post.username}</span>
                        <span class="post-date">${new Date(post.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <div class="post-content">${cleanXSS(post.content)}</div>
                ${imageTag}
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error(error);
    }
}

// ================= SISTEMA DE DMS (MENSAGENS) =================

async function loadUsersForDMs() {
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getUsers`);
        const users = await response.json();
        const listContainer = document.getElementById('dms-users-list');
        listContainer.innerHTML = '';

        const externalUsers = users.filter(u => u.id !== currentUser.id);

        if(externalUsers.length === 0) {
            listContainer.innerHTML = '<p style="font-size:0.8rem;color:var(--text-secondary);">Mais ninguém cadastrado.</p>';
            return;
        }

        externalUsers.forEach(user => {
            const div = document.createElement('div');
            div.className = `user-item ${activeRecipientId === user.id ? 'active' : ''}`;
            div.innerText = `@${user.username}`;
            div.addEventListener('click', () => startChatWith(user));
            listContainer.appendChild(div);
        });
    } catch (error) {
        console.error(error);
    }
}

function startChatWith(user) {
    activeRecipientId = user.id;
    document.getElementById('chat-header').innerText = `Mensagem direta com @${user.username}`;
    document.getElementById('chat-input-box').classList.remove('hidden');
    
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.toggle('active', item.innerText === `@${user.username}`);
    });

    clearInterval(dmsPolling);
    fetchMessages();
    dmsPolling = setInterval(fetchMessages, 4000);
}

async function fetchMessages() {
    if (!activeRecipientId) return;
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getDMs&userId1=${currentUser.id}&userId2=${activeRecipientId}`);
        const messages = await response.json();
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        messages.forEach(msg => {
            const bubble = document.createElement('div');
            const side = msg.senderId === currentUser.id ? 'sent' : 'received';
            bubble.className = `message-bubble ${side}`;
            bubble.innerText = msg.message;
            container.appendChild(bubble);
        });
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error(error);
    }
}

document.getElementById('send-dm-btn').addEventListener('click', pushDM);
document.getElementById('dm-message-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') pushDM();
});

async function pushDM() {
    const input = document.getElementById('dm-message-input');
    const msg = input.value.trim();
    if (!msg || !activeRecipientId) return;

    input.value = '';

    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'sendDM',
                senderId: currentUser.id,
                receiverId: activeRecipientId,
                message: msg
            })
        });
        fetchMessages();
    } catch (error) {
        console.error(error);
    }
}

// Higienização básica contra injeções XSS (códigos maliciosos postados)
function cleanXSS(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
