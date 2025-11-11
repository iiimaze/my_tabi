// 전역 변수
let posts = [];
let map = null;

// 데이터 로드
function loadPosts() {
    // postsData는 posts.js에서 로드됨
    if (typeof postsData !== 'undefined') {
        posts = postsData;
        console.log('게시글 데이터 로드 완료:', posts.length + '개');
    } else {
        console.error('데이터를 찾을 수 없습니다.');
        posts = [];
    }
}

// 지도 초기화
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [139.6917, 35.6895],
        zoom: 5
    });

    // 지도 로드 후 마커 추가
    map.on('load', () => {
        addMarkersToMap();
    });
}

// 지도에 모든 마커 추가
function addMarkersToMap() {
    posts.forEach(post => {
        post.days.forEach(day => {
            day.locations.forEach(location => {
                const marker = new maplibregl.Marker({
                    color: '#3498db',
                    scale: 1.2
                })
                    .setLngLat(location.coords)
                    .setPopup(new maplibregl.Popup({
                        offset: 25,
                        closeButton: false
                    }).setHTML(`
                        <div class="popup-title">${location.name}</div>
                        <div class="popup-description">${location.description}</div>
                        <div class="popup-post">${post.title}</div>
                    `))
                    .addTo(map);

                // 마커 클릭 시 해당 게시글 열기
                marker.getElement().addEventListener('click', () => {
                    openPost(post.id);
                });

                // 커서만 변경
                marker.getElement().style.cursor = 'pointer';
            });
        });
    });
}

// 게시글 카드 렌더링
function renderPosts() {
    const container = document.getElementById('postsScroll');
    container.innerHTML = '';

    posts.forEach(post => {
        // 미리보기 텍스트 생성 (첫 번째 day의 content에서 100자)
        const previewText = post.days && post.days.length > 0 && post.days[0].content
            ? post.days[0].content.substring(0, 100) + '...'
            : '내용 미리보기가 없습니다...';

        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        card.onclick = (e) => toggleCardExpansion(e, post.id);
        card.innerHTML = `
            <button class="post-card-close" onclick="event.stopPropagation(); closeCardExpansion()">✕</button>
            <img src="${post.thumbnail}" alt="${post.title}" class="post-card-image">
            <div class="post-card-content">
                <div class="post-card-title">${post.title}</div>
                <div class="post-card-date">${post.date}</div>
                <div class="post-card-preview">
                    ${post.tags && post.tags.length > 0 ? `
                        <div class="post-card-tags">
                            ${post.tags.map(tag => `<span class="post-card-tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                    <p class="post-card-preview-text">${previewText}</p>
                    <button class="btn-more" onclick="event.stopPropagation(); openPostInNewTab(${post.id})">더 보기</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// 카드 확장/축소 토글
let expandedCardId = null;

function toggleCardExpansion(e, postId) {
    // 더 보기 버튼과 닫기 버튼 클릭은 이미 stopPropagation 처리됨
    const card = e.currentTarget;
    const wasExpanded = card.classList.contains('expanded');
    const postsScroll = document.getElementById('postsScroll');

    // 모든 카드 축소
    document.querySelectorAll('.post-card').forEach(c => {
        c.classList.remove('expanded');
    });

    // 클릭한 카드가 축소 상태였다면 확장
    if (!wasExpanded) {
        card.classList.add('expanded');
        expandedCardId = postId;
        postsScroll.classList.add('has-expanded');
    } else {
        expandedCardId = null;
        postsScroll.classList.remove('has-expanded');
    }
}

// 카드 확장 닫기
function closeCardExpansion() {
    const postsScroll = document.getElementById('postsScroll');

    // 모든 카드 축소
    document.querySelectorAll('.post-card').forEach(c => {
        c.classList.remove('expanded');
    });

    expandedCardId = null;
    postsScroll.classList.remove('has-expanded');
}

// 새 탭에서 포스트 열기
function openPostInNewTab(postId) {
    window.open(`./post.html?id=${postId}`, '_blank');
}

// 게시글 상세 보기 (기존 함수, 호환성 유지)
function openPost(postId) {
    openPostInNewTab(postId);
}

// 기존 모달 방식 (사용 안 함)
function openPostModal(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const content = document.getElementById('postContent');

    let daysHtml = '';
    post.days.forEach((day, index) => {
        let locationsHtml = day.locations.map(loc =>
            `<li>📍 <strong>${loc.name}</strong>: ${loc.description}</li>`
        ).join('');

        daysHtml += `
            <div class="day-section">
                <h2 class="day-title">${day.title}</h2>
                <div class="day-content">${day.content}</div>
                <ul class="location-list">
                    ${locationsHtml}
                </ul>
                <div class="embedded-map" id="dayMap${index}"></div>
            </div>
        `;
    });

    content.innerHTML = `
        <button class="close-button" onclick="closePost()">×</button>
        <h1 class="post-title">${post.title}</h1>
        <div class="post-date">${post.date}</div>
        ${daysHtml}
    `;

    document.getElementById('postModal').style.display = 'block';
    document.body.style.overflow = 'hidden';

    // 각 일차별 지도 초기화
    setTimeout(() => {
        post.days.forEach((day, index) => {
            const dayMap = new maplibregl.Map({
                container: `dayMap${index}`,
                style: 'https://tiles.openfreemap.org/styles/liberty',
                center: day.locations[0].coords,
                zoom: 13
            });

            day.locations.forEach(location => {
                new maplibregl.Marker({ color: '#e74c3c' })
                    .setLngLat(location.coords)
                    .setPopup(new maplibregl.Popup().setHTML(`
                        <div class="popup-title">${location.name}</div>
                        <div class="popup-description">${location.description}</div>
                    `))
                    .addTo(dayMap);
            });
        });
    }, 100);
}

// 모달 닫기
function closePost() {
    document.getElementById('postModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 카테고리별 게시글 렌더링
function renderCategories() {
    const categorySection = document.getElementById('categorySection');

    // 모든 태그 수집
    const allTags = new Set();
    posts.forEach(post => {
        post.tags.forEach(tag => allTags.add(tag));
    });

    // 카테고리 섹션 HTML 생성
    let categoriesHtml = '<div class="category-section"><h2 class="category-title">지역별 여행</h2>';

    allTags.forEach(tag => {
        // 해당 태그를 가진 게시글 필터링
        const tagPosts = posts.filter(post => post.tags.includes(tag));

        if (tagPosts.length > 0) {
            categoriesHtml += `
                <div class="category-posts-wrapper">
                    <h3 class="category-name">${tag}</h3>
                    <div class="posts-scroll">
            `;

            tagPosts.forEach(post => {
                categoriesHtml += `
                    <div class="post-card" onclick="openPost(${post.id})">
                        <img src="${post.thumbnail}" alt="${post.title}" class="post-card-image">
                        <div class="post-card-content">
                            <div class="post-card-title">${post.title}</div>
                            <div class="post-card-date">${post.date}</div>
                        </div>
                    </div>
                `;
            });

            categoriesHtml += `
                    </div>
                </div>
            `;
        }
    });

    categoriesHtml += '</div>';
    categorySection.innerHTML = categoriesHtml;
}

// 상단으로 스크롤
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 이벤트 리스너
function setupEventListeners() {
    // 모달 외부 클릭 시 닫기
    document.getElementById('postModal').addEventListener('click', (e) => {
        if (e.target.id === 'postModal') {
            closePost();
        }
    });

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePost();
        }
    });
}

// 앱 초기화
function initApp() {
    console.log('앱 초기화 시작...');

    // 데이터 로드
    loadPosts();

    // UI 렌더링
    renderPosts();
    renderCategories();

    // 지도 초기화
    initMap();

    // 이벤트 리스너 설정
    setupEventListeners();

    console.log('앱 초기화 완료!');
}

// DOM 로드 후 실행
document.addEventListener('DOMContentLoaded', initApp);
