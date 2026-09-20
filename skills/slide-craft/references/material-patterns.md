# 필요한 재료만 골라 쓰기

아래는 내용 구조의 작은 예시다. 색·서체·간격·열 수·배치·도형을 그대로 따를 필요가 없다. 완성된 한 가지 양식을 조립하는 목록도 아니다. 필요한 새 요소를 자유롭게 작성한다.

## 자료와 질문

```html
<section data-piece class="source-and-question">
  <p data-edit>자료 A · 자료의 성격을 알리는 제목</p>
  <blockquote data-edit>제공받거나 확인한 원문</blockquote>
  <p data-edit>출처: 원자료의 출처</p>
  <h2 data-edit>활동 1 · 자료를 바탕으로 판단하기</h2>
  <p data-edit>(1) 자료의 어느 부분을 근거로 판단했나요?</p>
  <div data-edit data-answer-space class="response"></div>
</section>
```

자료를 발문 앞에 둘지 나란히 둘지는 읽는 순서와 지면에 맞춰 정한다. 빈 답란의 실제 높이는 CSS에서 응답 분량에 맞게 확보한다.

## 비교·분류·기록

```html
<section data-piece>
  <h2 data-edit>활동 2 · 관찰과 해석 구분하기</h2>
  <table>
    <thead><tr><th data-edit>살펴볼 대상</th><th data-edit>확인한 사실</th><th data-edit>나의 해석과 이유</th></tr></thead>
    <tbody><tr><th data-edit>비교 대상</th><td><small data-edit>필요한 경우에만 짧은 도움 질문</small><div data-edit data-answer-space class="response"></div></td><td data-edit></td></tr></tbody>
  </table>
</section>
```

자료의 성격에 따라 두 열, 여러 행, 시간축, 그림+설명, 병합 셀 등으로 바꾼다. 빈칸을 모두 같은 크기로 만들지 않는다.

## 선택과 짧은 근거

```html
<section data-piece>
  <p data-edit>먼저 한 가지를 고르고, 이유를 적어 봅시다.</p>
  <label><input type="checkbox"><span data-edit>선택 항목</span></label>
  <p data-edit class="response"></p>
</section>
```

종이용은 체크 표시를 쓸 공간을 확보한다. 선택 개수가 정해졌다면 안내에 밝힌다. 화면용은 라디오 버튼 등 적합한 입력을 사용할 수 있다.

## 만들기와 고쳐 쓰기

그림·설계 영역, 문구·설명, 근거를 각각 필요한 크기로 배치한다. 자유로운 발상이 목적이면 처음부터 잘게 나누지 않는다. 피드백을 반영하는 과제는 ‘다른 사람의 제안’과 ‘내가 바꾼 점’을 구분해 남길 수 있게 한다.

```html
<section data-piece class="make-and-revise">
  <div data-piece class="sketch-space"><p data-edit>그림이나 강조할 말을 구상하는 공간</p></div>
  <div><h3 data-edit>내가 만든 문구</h3><div data-edit class="response"></div></div>
  <div><h3 data-edit>근거 또는 설계 이유</h3><div data-edit class="response"></div></div>
</section>
```

이미지를 쓰는 과제라면 실제 이미지 파일을 data URL로 포함한 `img`와 편집 가능한 설명을 추가한다. 이미지를 쓰지 않는 과제에는 이미지 요소가 필요 없다.

## 슬라이드의 다양한 장면

```html
<section data-slide class="photo-scene">
  <figure data-piece>사진과 설명</figure>
  <h1 data-edit data-piece>관찰할 한 가지 질문</h1>
</section>
<section data-slide class="timeline-scene">
  <h1 data-edit>과정의 변화를 읽기</h1>
  <ol><li data-piece><h2 data-edit>첫 장면</h2><p data-edit>변화의 단서</p></li></ol>
</section>
```

사진, 비교, 시간축, 개념 연결, 실제 사례, 참여 과제는 서로 다른 구도를 쓸 수 있다. 복잡한 차트는 도구로 생성하거나 정확한 SVG를 작성하고, 수치·라벨·출처를 확인한다. 도형과 수식의 전용 조작은 필요할 때만 추가한다.
