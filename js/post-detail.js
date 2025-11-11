// URL에서 포스트 ID 가져오기
const urlParams = new URLSearchParams(window.location.search);
const postId = parseInt(urlParams.get('id'));

// 포스트 데이터 찾기
const post = postsData.find(p => p.id === postId);

if (!post) {
    document.getElementById('postArticle').innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #999;">
            <h2>포스트를 찾을 수 없습니다</h2>
            <p style="margin-top: 1rem;">
                <a href="./index.html" style="color: #4a90e2;">메인 페이지로 돌아가기</a>
            </p>
        </div>
    `;
} else {
    renderPost(post);
}

// 전역 변수로 지도 인스턴스 저장
let stickyMapInstance = null;

// 포스트 렌더링
function renderPost(post) {
    const article = document.getElementById('postArticle');

    // 문서 제목 변경
    document.title = `${post.title} - Travel Blog`;

    // 모든 장소 수집
    const allLocationNames = [];
    post.days.forEach(day => {
        if (day.locations && day.locations.length > 0) {
            day.locations.forEach(loc => {
                allLocationNames.push(loc.name);
            });
        }
    });

    let html = `
        <header class="post-header-content">
            <h1 class="post-title">${post.title}</h1>
            <div class="post-meta">
                <span class="post-date">
                    📅 ${post.date}
                </span>
                ${post.tags && post.tags.length > 0 ? `
                    <div class="post-tags">
                        ${post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
            ${allLocationNames.length > 0 ? `
                <div class="post-locations">
                    <span class="locations-label">📍 방문 장소:</span>
                    <span class="locations-list">${allLocationNames.join(', ')}</span>
                </div>
            ` : ''}
        </header>

        ${post.thumbnail ? `
            <img src="${post.thumbnail}" alt="${post.title}" class="post-thumbnail">
        ` : ''}
    `;

    // 각 일차별 내용
    post.days.forEach((day, dayIndex) => {
        html += `
            <section class="day-section">
                <h2 class="day-title">${day.title || `${dayIndex + 1}일차`}</h2>
        `;

        // 각 장소별 내용
        if (day.locations && day.locations.length > 0) {
            day.locations.forEach((location, locIndex) => {
                html += `
                    <div class="location-entry" data-coords="${location.coords[0]},${location.coords[1]}" onclick="zoomToLocation(${location.coords[0]}, ${location.coords[1]}, '${location.name}')">
                        <h3 class="location-entry-title">📍 ${location.name}</h3>
                        ${location.description ? `<p class="location-entry-desc">${location.description}</p>` : ''}

                        ${location.image ? `
                            <img src="${location.image}" alt="${location.name}" class="location-entry-image">
                        ` : ''}

                        ${location.content ? `
                            <div class="location-entry-content">${location.content}</div>
                        ` : ''}
                    </div>
                `;
            });

            // 일차별 지도 추가
            html += `
                <div class="day-map-section">
                    <h3 class="day-map-title">🗺️ ${dayIndex + 1}일차 방문 장소</h3>
                    <div id="dayMap${dayIndex}" class="day-map"></div>
                </div>
            `;
        }

        html += `</section>`;
    });

    article.innerHTML = html;

    // 각 일차별 지도 초기화
    post.days.forEach((day, index) => {
        if (day.locations && day.locations.length > 0) {
            setTimeout(() => {
                initDayMap(index, day.locations);
            }, 100);
        }
    });

    // 우측 하단 고정 지도 초기화 (모든 장소 표시)
    setTimeout(() => {
        initStickyMap(post);
    }, 100);
}

// 일차별 지도 초기화
function initDayMap(dayIndex, locations) {
    const mapElement = document.getElementById(`dayMap${dayIndex}`);
    if (!mapElement) return;

    // 지도 중심 계산
    const avgLng = locations.reduce((sum, loc) => sum + loc.coords[0], 0) / locations.length;
    const avgLat = locations.reduce((sum, loc) => sum + loc.coords[1], 0) / locations.length;

    const map = new maplibregl.Map({
        container: `dayMap${dayIndex}`,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [avgLng, avgLat],
        zoom: locations.length === 1 ? 12 : 10
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // 마커 추가
    locations.forEach((location, index) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'map-marker';
        markerElement.innerHTML = `${index + 1}`;
        markerElement.style.cssText = `
            background: #4a90e2;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;

        const marker = new maplibregl.Marker({ element: markerElement })
            .setLngLat(location.coords)
            .setPopup(
                new maplibregl.Popup({ offset: 25 })
                    .setHTML(`
                        <div style="padding: 0.75rem;">
                            <strong style="font-size: 1rem;">${location.name}</strong><br>
                            ${location.description ? `<small style="color: #666;">${location.description}</small>` : ''}
                        </div>
                    `)
            )
            .addTo(map);
    });

    // 모든 마커가 보이도록 지도 조정
    if (locations.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        locations.forEach(loc => bounds.extend(loc.coords));
        map.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
}

// 우측 하단 고정 지도 초기화 (전체 여행 경로)
function initStickyMap(post) {
    const mapElement = document.getElementById('stickyMap');
    if (!mapElement) return;

    // 모든 일차의 장소 수집
    const allLocations = [];
    post.days.forEach((day, dayIndex) => {
        if (day.locations && day.locations.length > 0) {
            day.locations.forEach((location, locIndex) => {
                allLocations.push({
                    ...location,
                    dayIndex: dayIndex,
                    dayTitle: day.title || `${dayIndex + 1}일차`
                });
            });
        }
    });

    if (allLocations.length === 0) return;

    // 지도 중심 계산
    const avgLng = allLocations.reduce((sum, loc) => sum + loc.coords[0], 0) / allLocations.length;
    const avgLat = allLocations.reduce((sum, loc) => sum + loc.coords[1], 0) / allLocations.length;

    const map = new maplibregl.Map({
        container: 'stickyMap',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [avgLng, avgLat],
        zoom: allLocations.length === 1 ? 12 : 8
    });

    // 전역 변수에 지도 인스턴스 저장
    stickyMapInstance = map;

    // 마커 추가
    allLocations.forEach((location, index) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'map-marker';
        markerElement.innerHTML = `${index + 1}`;
        markerElement.style.cssText = `
            background: #4a90e2;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 10px;
            border: 1px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            cursor: pointer;
        `;

        const marker = new maplibregl.Marker({ element: markerElement })
            .setLngLat(location.coords)
            .setPopup(
                new maplibregl.Popup({ offset: 15 })
                    .setHTML(`
                        <div style="padding: 0.5rem; font-size: 0.75rem;">
                            <strong style="display: block; margin-bottom: 0.25rem;">${location.name}</strong>
                            <small style="color: #666;">${location.dayTitle}</small>
                        </div>
                    `)
            )
            .addTo(map);
    });

    // 모든 마커가 보이도록 지도 조정
    if (allLocations.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        allLocations.forEach(loc => bounds.extend(loc.coords));
        map.fitBounds(bounds, { padding: 20, maxZoom: 10 });
    }
}

// 장소 클릭 시 지도 줌인
function zoomToLocation(lng, lat, name) {
    if (!stickyMapInstance) return;

    // 지도를 해당 위치로 부드럽게 이동하며 줌인
    stickyMapInstance.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 1500,
        essential: true
    });
}
