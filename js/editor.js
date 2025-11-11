// 전역 변수
let locationPickerMap;
let currentDayIndex = null;
let currentLocationIndex = null;
let days = [];
let quillEditors = {}; // Quill 에디터 인스턴스 저장 {dayIndex-locationIndex: quill}
let thumbnailDataUrl = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function () {
    setupThumbnailUpload();
    addDay(); // 기본 1일차 추가
});

// 날짜 선택 시 로그 (디버깅용)
function updateDateDisplay() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    console.log('날짜 변경:', { startDate, endDate });
}

// 썸네일 업로드 설정
function setupThumbnailUpload() {
    const uploadArea = document.getElementById('thumbnailUploadArea');
    const fileInput = document.getElementById('thumbnailFile');

    uploadArea.addEventListener('click', function (e) {
        if (e.target.classList.contains('btn-remove-thumbnail')) return;
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleThumbnailFile(files[0]);
        } else {
            alert('이미지 파일만 업로드 가능합니다.');
        }
    });
}

// 썸네일 파일 업로드 처리
function handleThumbnailUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleThumbnailFile(file);
    } else {
        alert('이미지 파일만 업로드 가능합니다.');
    }
}

// 썸네일 파일 처리
function handleThumbnailFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        thumbnailDataUrl = e.target.result;

        document.getElementById('uploadPlaceholder').style.display = 'none';
        document.getElementById('uploadPreview').style.display = 'block';
        document.getElementById('thumbnailPreviewImg').src = thumbnailDataUrl;
    };

    reader.readAsDataURL(file);
}

// 썸네일 제거
function removeThumbnail() {
    thumbnailDataUrl = null;

    document.getElementById('uploadPlaceholder').style.display = 'flex';
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('thumbnailPreviewImg').src = '';
    document.getElementById('thumbnailFile').value = '';
}

// 장소 선택 지도 초기화
function initLocationPickerMap(center = [127.0, 37.5], zoom = 5) {
    if (locationPickerMap) {
        locationPickerMap.remove();
    }

    locationPickerMap = new maplibregl.Map({
        container: 'locationPickerMap',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: center,
        zoom: zoom
    });

    locationPickerMap.addControl(new maplibregl.NavigationControl(), 'top-right');
}

// 장소 검색
async function searchLocation() {
    const query = document.getElementById('locationSearch').value.trim();
    const searchResults = document.getElementById('searchResults');

    if (!query) {
        alert('장소명을 입력해주세요.');
        return;
    }

    searchResults.classList.add('active');
    searchResults.innerHTML = '<div class="search-loading">검색 중...</div>';

    try {
        let response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&addressdetails=1`);
        let data = await response.json();

        if (data.length === 0) {
            const queryWithHints = query + ' japan korea';
            response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryWithHints)}&format=json&limit=10&addressdetails=1`);
            data = await response.json();
        }

        if (data.length === 0) {
            searchResults.innerHTML = `
                <div class="search-no-results">
                    검색 결과가 없습니다.<br>
                    <small style="margin-top: 0.5rem; display: block;">
                        💡 팁: 영어나 일본어로도 시도해보세요.<br>
                        예: "Lake Toya" 또는 "洞爺湖"
                    </small>
                </div>
            `;
            return;
        }

        const uniqueResults = [];
        const seen = new Set();

        for (const place of data) {
            const key = `${place.lat}_${place.lon}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueResults.push(place);
            }
            if (uniqueResults.length >= 5) break;
        }

        searchResults.innerHTML = uniqueResults.map((place, index) => {
            const name = place.name || place.display_name.split(',')[0];
            const address = place.display_name;
            return `
                <div class="search-result-item" onclick="selectSearchResult(${index}, '${name.replace(/'/g, "\\'")}', ${place.lon}, ${place.lat})">
                    <div class="search-result-name">${name}</div>
                    <div class="search-result-address">${address}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('검색 오류:', error);
        searchResults.innerHTML = '<div class="search-no-results">검색 중 오류가 발생했습니다.<br><small>잠시 후 다시 시도해주세요.</small></div>';
    }
}

// 검색 결과 선택
function selectSearchResult(index, displayName, lng, lat) {
    document.getElementById('locationName').value = displayName.split(',')[0];
    document.getElementById('locationLng').value = lng;
    document.getElementById('locationLat').value = lat;

    document.getElementById('searchResults').classList.remove('active');

    if (locationPickerMap) {
        locationPickerMap.flyTo({
            center: [lng, lat],
            zoom: 14
        });

        const existingMarkers = document.querySelectorAll('#locationPickerMap .maplibregl-marker');
        existingMarkers.forEach(m => m.remove());

        new maplibregl.Marker()
            .setLngLat([lng, lat])
            .addTo(locationPickerMap);
    }
}

// 일차 추가
function addDay() {
    const dayNumber = days.length + 1;
    const dayIndex = days.length;

    const day = {
        locations: [] // 각 장소는 {name, coords, description, image, content} 구조
    };
    days.push(day);

    const dayCard = document.createElement('div');
    dayCard.className = 'day-card';
    dayCard.dataset.dayIndex = dayIndex;
    dayCard.innerHTML = `
        <div class="day-card-header">
            <span class="day-number">${dayNumber}일차</span>
            <div class="day-header-actions">
                <button type="button" class="btn-add-location-inline" onclick="openLocationModal(${dayIndex})">+ 장소 추가</button>
                <button type="button" class="btn-remove-day" onclick="removeDay(${dayIndex})">삭제</button>
            </div>
        </div>

        <div class="locations-list" id="locations-list-${dayIndex}">
            <div class="empty-locations">
                <p>📍 장소를 추가하여 여행 기록을 시작하세요</p>
                <button type="button" class="btn-add-location-empty" onclick="openLocationModal(${dayIndex})">+ 첫 번째 장소 추가</button>
            </div>
        </div>
    `;

    document.getElementById('daysContainer').appendChild(dayCard);
}

// 일차 삭제
function removeDay(index) {
    if (days.length <= 1) {
        alert('최소 1개의 일차가 필요합니다.');
        return;
    }

    if (confirm('이 일차를 삭제하시겠습니까?')) {
        // 해당 일차의 모든 Quill 에디터 삭제
        days[index].locations.forEach((loc, locIndex) => {
            const editorKey = `${index}-${locIndex}`;
            delete quillEditors[editorKey];
        });

        days.splice(index, 1);
        renderDays();
    }
}

// 일차 목록 다시 렌더링
function renderDays() {
    const container = document.getElementById('daysContainer');
    container.innerHTML = '';

    // Quill 에디터 초기화
    const oldEditors = { ...quillEditors };
    quillEditors = {};

    days.forEach((day, dayIndex) => {
        const dayNumber = dayIndex + 1;
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.dataset.dayIndex = dayIndex;
        dayCard.innerHTML = `
            <div class="day-card-header">
                <span class="day-number">${dayNumber}일차</span>
                <div class="day-header-actions">
                    <button type="button" class="btn-add-location-inline" onclick="openLocationModal(${dayIndex})">+ 장소 추가</button>
                    <button type="button" class="btn-remove-day" onclick="removeDay(${dayIndex})">삭제</button>
                </div>
            </div>

            <div class="locations-list" id="locations-list-${dayIndex}">
                ${day.locations.length === 0 ? `
                    <div class="empty-locations">
                        <p>📍 장소를 추가하여 여행 기록을 시작하세요</p>
                        <button type="button" class="btn-add-location-empty" onclick="openLocationModal(${dayIndex})">+ 첫 번째 장소 추가</button>
                    </div>
                ` : ''}
            </div>
        `;
        container.appendChild(dayCard);

        // 각 장소 렌더링
        day.locations.forEach((location, locIndex) => {
            addLocationCard(dayIndex, locIndex, location);
        });
    });
}

// 장소 카드 추가
function addLocationCard(dayIndex, locIndex, location) {
    const locationsList = document.getElementById(`locations-list-${dayIndex}`);

    // empty-locations 제거
    const emptyDiv = locationsList.querySelector('.empty-locations');
    if (emptyDiv) {
        emptyDiv.remove();
    }

    const locationCard = document.createElement('div');
    locationCard.className = 'location-entry-card';
    locationCard.dataset.dayIndex = dayIndex;
    locationCard.dataset.locIndex = locIndex;

    const editorId = `quill-${dayIndex}-${locIndex}`;
    const imageUploadId = `image-upload-${dayIndex}-${locIndex}`;
    const imagePreviewId = `image-preview-${dayIndex}-${locIndex}`;
    const imageInputId = `image-input-${dayIndex}-${locIndex}`;

    locationCard.innerHTML = `
        <div class="location-entry-header">
            <div class="location-entry-info">
                <span class="location-entry-number">${locIndex + 1}</span>
                <div class="location-entry-name">
                    <strong>📍 ${location.name}</strong>
                    <small>${location.description || location.coords.join(', ')}</small>
                </div>
            </div>
            <button type="button" class="btn-remove-location-entry" onclick="removeLocationEntry(${dayIndex}, ${locIndex})">삭제</button>
        </div>

        <div class="location-entry-body">
            <!-- 이미지 업로드 영역 -->
            <div class="location-image-upload" id="${imageUploadId}">
                <input type="file" id="${imageInputId}" accept="image/*" style="display: none;" onchange="handleLocationImageUpload(${dayIndex}, ${locIndex}, event)">
                <div class="image-upload-placeholder" id="placeholder-${dayIndex}-${locIndex}" onclick="document.getElementById('${imageInputId}').click()">
                    <div class="upload-icon">📷</div>
                    <p>이미지 추가 (클릭 또는 드래그)</p>
                </div>
                <div class="image-preview-container" id="${imagePreviewId}" style="display: none;">
                    <img class="location-image" id="img-${dayIndex}-${locIndex}" alt="Location image">
                    <button type="button" class="btn-remove-image" onclick="removeLocationImage(${dayIndex}, ${locIndex})">×</button>
                </div>
            </div>

            <!-- 텍스트 에디터 -->
            <div class="location-content-editor">
                <div id="${editorId}" class="location-quill-editor"></div>
            </div>
        </div>
    `;

    locationsList.appendChild(locationCard);

    // 이미지 업로드 드래그앤드롭 설정
    setupLocationImageDragDrop(dayIndex, locIndex);

    // Quill 에디터 초기화
    initLocationQuillEditor(dayIndex, locIndex, location.content);

    // 이미지가 있으면 표시
    if (location.image) {
        document.getElementById(`placeholder-${dayIndex}-${locIndex}`).style.display = 'none';
        document.getElementById(imagePreviewId).style.display = 'block';
        document.getElementById(`img-${dayIndex}-${locIndex}`).src = location.image;
    }
}

// 장소별 이미지 드래그앤드롭 설정
function setupLocationImageDragDrop(dayIndex, locIndex) {
    const uploadArea = document.getElementById(`image-upload-${dayIndex}-${locIndex}`);
    const placeholder = document.getElementById(`placeholder-${dayIndex}-${locIndex}`);

    placeholder.addEventListener('dragover', function (e) {
        e.preventDefault();
        placeholder.classList.add('drag-over');
    });

    placeholder.addEventListener('dragleave', function (e) {
        e.preventDefault();
        placeholder.classList.remove('drag-over');
    });

    placeholder.addEventListener('drop', function (e) {
        e.preventDefault();
        placeholder.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleLocationImageFile(dayIndex, locIndex, files[0]);
        } else {
            alert('이미지 파일만 업로드 가능합니다.');
        }
    });
}

// 장소 이미지 업로드 처리
function handleLocationImageUpload(dayIndex, locIndex, event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleLocationImageFile(dayIndex, locIndex, file);
    } else {
        alert('이미지 파일만 업로드 가능합니다.');
    }
}

// 장소 이미지 파일 처리
function handleLocationImageFile(dayIndex, locIndex, file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        const imageDataUrl = e.target.result;
        days[dayIndex].locations[locIndex].image = imageDataUrl;

        // UI 업데이트
        document.getElementById(`placeholder-${dayIndex}-${locIndex}`).style.display = 'none';
        document.getElementById(`image-preview-${dayIndex}-${locIndex}`).style.display = 'block';
        document.getElementById(`img-${dayIndex}-${locIndex}`).src = imageDataUrl;
    };

    reader.readAsDataURL(file);
}

// 장소 이미지 제거
function removeLocationImage(dayIndex, locIndex) {
    if (confirm('이미지를 삭제하시겠습니까?')) {
        days[dayIndex].locations[locIndex].image = null;

        document.getElementById(`placeholder-${dayIndex}-${locIndex}`).style.display = 'flex';
        document.getElementById(`image-preview-${dayIndex}-${locIndex}`).style.display = 'none';
        document.getElementById(`img-${dayIndex}-${locIndex}`).src = '';
        document.getElementById(`image-input-${dayIndex}-${locIndex}`).value = '';
    }
}

// 장소별 Quill 에디터 초기화
function initLocationQuillEditor(dayIndex, locIndex, initialContent = '') {
    const editorId = `quill-${dayIndex}-${locIndex}`;
    const editorKey = `${dayIndex}-${locIndex}`;

    const toolbarOptions = [
        [{ 'header': [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['blockquote'],
        ['link'],
        ['clean']
    ];

    const quill = new Quill(`#${editorId}`, {
        theme: 'snow',
        modules: {
            toolbar: toolbarOptions
        },
        placeholder: '이 장소에 대한 내용을 작성하세요...'
    });

    // 내용이 있으면 복원
    if (initialContent) {
        quill.root.innerHTML = initialContent;
    }

    // 내용 변경 시 days 배열에 저장
    quill.on('text-change', function() {
        days[dayIndex].locations[locIndex].content = quill.root.innerHTML;
    });

    quillEditors[editorKey] = quill;
}

// 장소 항목 삭제
function removeLocationEntry(dayIndex, locIndex) {
    if (confirm('이 장소를 삭제하시겠습니까?')) {
        const editorKey = `${dayIndex}-${locIndex}`;
        delete quillEditors[editorKey];

        days[dayIndex].locations.splice(locIndex, 1);
        renderDays();
    }
}

// 장소 추가 모달 열기
function openLocationModal(dayIndex) {
    currentDayIndex = dayIndex;
    const modal = document.getElementById('locationModal');
    modal.classList.add('active');

    document.getElementById('locationSearch').value = '';
    document.getElementById('locationName').value = '';
    document.getElementById('locationLng').value = '';
    document.getElementById('locationLat').value = '';
    document.getElementById('locationDesc').value = '';
    document.getElementById('searchResults').classList.remove('active');
    document.getElementById('searchResults').innerHTML = '';

    setTimeout(() => {
        initLocationPickerMap();
    }, 100);
}

// 장소 추가 모달 닫기
function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    modal.classList.remove('active');
    currentDayIndex = null;

    if (locationPickerMap) {
        locationPickerMap.remove();
        locationPickerMap = null;
    }
}

// 장소 추가 확인
function confirmLocation() {
    const name = document.getElementById('locationName').value.trim();
    const lng = parseFloat(document.getElementById('locationLng').value);
    const lat = parseFloat(document.getElementById('locationLat').value);
    const desc = document.getElementById('locationDesc').value.trim();

    if (!name || isNaN(lng) || isNaN(lat)) {
        alert('모든 필드를 올바르게 입력해주세요.');
        return;
    }

    const location = {
        name: name,
        coords: [lng, lat],
        description: desc || '',
        image: null,
        content: ''
    };

    const locIndex = days[currentDayIndex].locations.length;
    days[currentDayIndex].locations.push(location);

    // UI에 장소 카드 추가
    addLocationCard(currentDayIndex, locIndex, location);

    closeLocationModal();
}

// 미리보기
function previewPost() {
    const title = document.getElementById('postTitle').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const tags = document.getElementById('postTags').value.trim();

    if (!title) {
        alert('제목을 입력해주세요.');
        return;
    }

    const previewContent = document.getElementById('previewContent');
    const dateRange = startDate && endDate
        ? `${startDate.replace(/-/g, '.')} - ${endDate.replace(/-/g, '.')}`
        : '날짜 미정';

    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];

    let html = `
        <div class="preview-header">
            ${thumbnailDataUrl ? `<img src="${thumbnailDataUrl}" alt="${title}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 8px; margin-bottom: 2rem;">` : ''}
            <h1 class="preview-title">${title}</h1>
            <div class="preview-meta">
                <span>📅 ${dateRange}</span>
            </div>
            ${tagList.length > 0 ? `
                <div class="preview-tags">
                    ${tagList.map(tag => `<span class="preview-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;

    days.forEach((day, dayIndex) => {
        html += `<div class="preview-day">
            <h2 class="preview-day-title">${dayIndex + 1}일차</h2>
        `;

        day.locations.forEach((location, locIndex) => {
            const editorKey = `${dayIndex}-${locIndex}`;
            const editor = quillEditors[editorKey];
            const content = editor ? editor.root.innerHTML : location.content;

            html += `
                <div class="preview-location-entry">
                    <h3 class="preview-location-name">📍 ${location.name}</h3>
                    ${location.description ? `<p class="preview-location-desc">${location.description}</p>` : ''}
                    ${location.image ? `<img src="${location.image}" alt="${location.name}" class="preview-location-image">` : ''}
                    <div class="preview-location-content">${content || '<p style="color: #999;">내용 없음</p>'}</div>
                </div>
            `;
        });

        html += `</div>`;
    });

    previewContent.innerHTML = html;

    const modal = document.getElementById('previewModal');
    modal.classList.add('active');
}

// 미리보기 모달 닫기
function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    modal.classList.remove('active');
}

// 저장하기
function savePost() {
    const title = document.getElementById('postTitle').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const tags = document.getElementById('postTags').value.trim();

    if (!title) {
        alert('제목을 입력해주세요.');
        return;
    }

    if (!startDate || !endDate) {
        alert('여행 기간을 입력해주세요.');
        return;
    }

    // 데이터 검증
    const validDays = days.filter(day => day.locations.length > 0);

    if (validDays.length === 0) {
        alert('최소 1개 이상의 장소를 추가해주세요.');
        return;
    }

    const dateRange = `${startDate.replace(/-/g, '.')} - ${endDate.replace(/-/g, '.')}`;
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];

    // 포스트 객체 생성
    const post = {
        id: Date.now(),
        title: title,
        date: dateRange,
        thumbnail: thumbnailDataUrl || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400',
        tags: tagList,
        days: validDays.map((day, index) => {
            const actualDayIndex = days.indexOf(day);

            return {
                title: `${index + 1}일차`,
                locations: day.locations.map((location, locIndex) => {
                    const editorKey = `${actualDayIndex}-${locIndex}`;
                    const editor = quillEditors[editorKey];

                    return {
                        name: location.name,
                        coords: location.coords,
                        description: location.description,
                        image: location.image,
                        content: editor ? editor.root.innerHTML : location.content
                    };
                })
            };
        })
    };

    // JavaScript 파일로 다운로드
    const filename = title.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const fileContent = `// ${title}\nconst post_${filename.replace(/-/g, '_')} = ${JSON.stringify(post, null, 4)};\n`;

    const blob = new Blob([fileContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('포스트가 저장되었습니다!\n\n다운로드된 파일을 data/posts/ 폴더에 넣고,\ndata/posts/index.js와 index.html을 업데이트해주세요.');
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'locationModal') {
            closeLocationModal();
        } else if (e.target.id === 'previewModal') {
            closePreviewModal();
        }
    }
});
