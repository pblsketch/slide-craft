/* 디자인은 문서가 소유한다. 선택한 내용의 편집과 저장만 연결한다. */
(() => {
  'use strict';
  const doc = document, root = doc.querySelector('[data-teach-document]') || doc.querySelector('main');
  if (!root || window.__teachFreeform) return;
  doc.querySelectorAll('[data-teach-controls],[data-teach-overlay]').forEach(e=>e.remove());
  root.querySelectorAll('.teach-selected').forEach(e=>e.classList.remove('teach-selected'));
  const slides = doc.body.dataset.teachKind === 'slides';
  const all = (s, parent = root) => [...parent.querySelectorAll(s)];
  const frames = () => all('[data-slide]');
  const mm = 96 / 25.4;
  let ctx = {}, editable = true, presenting = false, current = 0, timer, history = [], cursor = -1, saved = '', lastRange, gesture;
  const ui = doc.createElement('aside');
  ui.dataset.teachControls = '';
  ui.setAttribute('aria-label', '문서 편집 도구');
  const button = (cmd, label, extra = '') => `<button type="button" data-cmd="${cmd}" ${extra}>${label}</button>`;
  ui.innerHTML = `<div class="teach-bar"><span data-label>수업자료 편집 <small data-state>변경 없음</small></span>
    <details><summary>＋ 추가</summary><div>${button('text','글상자')}${button('answer','답란')}${button('table','표')}${button('image','이미지')}</div></details>
    ${button('undo','↶','aria-label="되돌리기" title="되돌리기 (Ctrl+Z)"')}${button('redo','↷','aria-label="다시 하기" title="다시 하기 (Ctrl+Shift+Z)"')}
    ${button('mode','미리보기')}${slides ? button('present','발표 보기') + button('prev','←','aria-label="이전 장"') + '<span data-counter></span>' + button('next','→','aria-label="다음 장"') : ''}
    ${button('print','인쇄 / PDF')}${button('save','HTML 저장')}</div>
    <div class="teach-selection"><span data-selection>글·표·이미지·답란을 누르면 편집 도구가 나타납니다.</span>${button('inspector','도구 접기','hidden')}</div>
    <div class="teach-inspector" hidden>
      <fieldset data-tools="text"><legend>글</legend>
        <label>글꼴<select data-prop="font"><option value="">문서 기본값</option><option value="'맑은 고딕',sans-serif">맑은 고딕</option><option value="'바탕',serif">바탕</option><option value="Arial,sans-serif">Arial</option><option value="Georgia,serif">Georgia</option></select></label>
        <label>크기 <span>pt</span><input data-prop="font-size" type="number" min="6" max="160" step="0.1"></label>
        <label>줄 간격 <span>배</span><input data-prop="line-height" type="number" min="0.8" max="4" step="0.1"></label>
        ${button('bold','굵게')}${button('italic','기울임')}${button('underline','밑줄')}
        <label>정렬<select data-prop="align"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option><option value="justify">양쪽</option></select></label>
        <label>글자 색<input data-prop="color" type="color" value="#28584f"></label>
      </fieldset>
      <fieldset data-tools="table"><legend>표 <span data-cell-label></span></legend>
        ${button('row','행 추가')}${button('delete-row','행 삭제')}${button('column','열 추가')}${button('delete-column','열 삭제')}
        <label>선택 열 너비 <span>%</span><input data-prop="column-width" type="number" min="5" max="95" step="1"></label><small data-table-note></small>
        <label>행 높이 <span>mm</span><input data-prop="row-height" type="number" min="4" max="1000" step="0.1"></label>
      </fieldset>
      <fieldset data-tools="image"><legend>이미지 · 비율 유지</legend>
        <label>너비 <span>px</span><input data-prop="image-width" type="number" min="16" max="4096" step="1"></label>${button('replace-image','이미지 바꾸기')}
        <label>설명<input data-prop="image-alt" type="text"></label>
      </fieldset>
      <fieldset data-tools="answer"><legend>답란</legend>
        <label>높이 <span>mm</span><input data-prop="answer-height" type="number" min="4" max="1000" step="0.1"></label>
        <label>괘선 수<input data-prop="answer-lines" type="number" min="0" max="30" step="1"></label>
        <label>줄 간격 <span>mm</span><input data-prop="answer-pitch" type="number" min="4" max="15" step="0.1"></label>
      </fieldset>
      <fieldset data-tools="piece"><legend>선택 영역</legend>${button('copy','복제')}${button('up','위로')}${button('down','아래로')}${button('delete','삭제','class="teach-danger"')}
        ${slides ? '<label>너비 <span>px</span><input data-prop="piece-width" type="number" min="24" max="4096"></label><label>높이 <span>px</span><input data-prop="piece-height" type="number" min="24" max="4096"></label><small>화면 손잡이로 이동·크기 조절</small>' : ''}
      </fieldset>
    </div>${slides ? `<div class="teach-slide-actions">현재 장 ${button('copy-slide','복제')}${button('up-slide','앞으로')}${button('down-slide','뒤로')}${button('delete-slide','삭제')}</div>` : ''}
    <div data-msg role="status" aria-live="polite"></div>`;
  doc.body.prepend(ui);
  const pieceActions=doc.createElement('span');pieceActions.dataset.pieceActions='';pieceActions.hidden=true;
  ui.querySelectorAll('[data-tools=piece] button').forEach(button=>pieceActions.append(button));
  ui.querySelector('[data-selection]').after(pieceActions);
  const overlay = doc.createElement('div');
  overlay.dataset.teachOverlay = '';
  overlay.hidden = true;
  overlay.innerHTML = '<button type="button" data-drag="move" aria-label="선택 영역 이동" title="끌어서 이동 · 방향키로 미세 조정">✥ 이동</button><button type="button" data-drag="resize" aria-label="선택 영역 크기 조절" title="끌어서 크기 조절 · 방향키로 미세 조정">↘</button>';
  doc.body.append(overlay);
  const say = text => { const message=ui.querySelector('[data-msg]');message.textContent=text;message.title=text; };
  const active = () => slides ? frames()[current] : root;
  const field = name => ui.querySelector(`[data-prop="${name}"]`);
  const valid = el => el?.isConnected && root.contains(el);
  const hasContent = el => !!el.textContent.trim() || !!el.querySelector('img,svg,input,textarea,select');
  const merged = table => !!table?.querySelector('[rowspan]:not([rowspan="1"]),[colspan]:not([colspan="1"]),col[span]:not([span="1"])');
  function prepare() { all('[data-edit]').forEach(e => e.contentEditable = String(editable)); }
  function scale(el) {
    const box = el.getBoundingClientRect();
    return {x: box.width / (el.offsetWidth || box.width || 1) || 1, y: box.height / (el.offsetHeight || box.height || 1) || 1};
  }
  function drawOverlay() {
    const el = ctx.piece, frame = el?.closest('[data-slide]');
    overlay.hidden = !(slides && editable && valid(el) && frame && frame !== el);
    if (overlay.hidden) return;
    const r = el.getBoundingClientRect();
    Object.assign(overlay.style, {left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
  }
  function syncInspector() {
    const on = editable && valid(ctx.piece);
    ui.querySelector('.teach-inspector').hidden = !on;
    ui.querySelector('[data-cmd=inspector]').hidden = !on;
    pieceActions.hidden=!on;
    ui.querySelector('[data-cmd=inspector]').textContent = '도구 접기';
    ui.querySelector('[data-selection]').textContent = !editable ? '미리보기 중 · 편집하기를 누르면 다시 수정할 수 있습니다.' : !on ? '글·표·이미지·답란을 누르면 편집 도구가 나타납니다.' : `${ctx.answer ? '답란' : ctx.cell ? '표의 셀' : ctx.image ? '이미지' : ctx.text ? '글' : '영역'} 선택됨`;
    const tools = {text:ctx.text,table:ctx.table,image:ctx.image,answer:ctx.answer,piece:ctx.piece};
    Object.entries(tools).forEach(([key, el]) => ui.querySelector(`[data-tools=${key}]`).hidden = !(on && valid(el)));
    if(!slides)ui.querySelector('[data-tools=piece]').hidden=true;
    if (valid(ctx.text)) {
      const style = getComputedStyle(ctx.text), font = field('font');
      font.querySelector('[data-current-font]')?.remove();
      const existing = ctx.text.style.fontFamily || '';
      const normalize=s=>s.replace(/[\s'"]/g,'').toLowerCase(), match=[...font.options].find(o=>normalize(o.value)===normalize(existing));
      if (existing && !match) { const o=doc.createElement('option');o.value=existing;o.textContent='현재 글꼴';o.dataset.currentFont='';font.append(o); }
      font.value=match?match.value:existing;
      field('font-size').value=Math.round(parseFloat(style.fontSize)*0.75*10)/10;
      field('line-height').value=Math.round((parseFloat(style.lineHeight)/parseFloat(style.fontSize)||1.5)*10)/10;
      field('align').value=['left','center','right','justify'].includes(style.textAlign)?style.textAlign:'left';
      const rgb=style.color.match(/\d+/g);if(rgb)field('color').value='#'+rgb.slice(0,3).map(v=>(+v).toString(16).padStart(2,'0')).join('');
    }
    if(valid(ctx.table)) {
      const index=ctx.cell?.cellIndex;
      ui.querySelector('[data-cell-label]').textContent=index == null?'':`${ctx.cell.parentElement.rowIndex+1}행 ${index+1}열`;
      const locked=merged(ctx.table);
      for(const name of ['row','column','delete-row','delete-column'])ui.querySelector(`[data-cmd=${name}]`).disabled=locked || (name.startsWith('delete')&&!ctx.cell);
      field('column-width').disabled=locked || !ctx.cell || ctx.cell.parentElement.cells.length<2;
      if(ctx.cell)field('column-width').value=Math.round(ctx.cell.getBoundingClientRect().width/ctx.table.getBoundingClientRect().width*100);
      field('row-height').disabled=!ctx.cell;if(ctx.cell)field('row-height').value=Math.round(ctx.cell.parentElement.offsetHeight/mm*10)/10;
      ui.querySelector('[data-table-note]').textContent=locked?'병합 표는 내용·서식 편집만 가능합니다.':'';
    }
    if(valid(ctx.image)){field('image-width').value=Math.round(ctx.image.offsetWidth);field('image-alt').value=ctx.image.alt;}
    if(valid(ctx.answer)) {
      field('answer-height').value=Math.round(ctx.answer.offsetHeight/mm*10)/10;
      field('answer-lines').value=ctx.answer.dataset.answerLines||0;
      field('answer-pitch').value=ctx.answer.dataset.answerPitch||7.5;
    }
    if(slides&&on){field('piece-width').value=Math.round(ctx.piece.offsetWidth);field('piece-height').value=Math.round(ctx.piece.offsetHeight);}
    drawOverlay();
  }
  function choose(anchor) {
    all('.teach-selected').forEach(el=>el.classList.remove('teach-selected'));
    if(!valid(anchor)||!editable){ctx={};syncInspector();return;}
    const piece=anchor.closest('[data-piece]')||anchor.closest('[data-edit]')||anchor.closest('figure,table');
    ctx={anchor,piece,text:anchor.closest('[data-edit]'),cell:anchor.closest('td,th')};
    ctx.table=ctx.cell?.closest('table')||(piece?.matches('table')?piece:piece?.querySelector('table'));
    ctx.image=anchor.closest('img')||(piece?.matches('img')?piece:piece?.querySelector('img'));
    ctx.answer=anchor.closest('[data-answer-space]');
    if(piece)piece.classList.add('teach-selected');
    const frame=anchor.closest('[data-slide]');if(frame)current=frames().indexOf(frame);
    syncInspector();updateNavigation();
  }
  function cleanCopy(original) {
    const clone=original.cloneNode(true), live=all('input,textarea,select',original), copied=all('input,textarea,select',clone);
    live.forEach((el,i)=>{const c=copied[i];if(el.tagName==='TEXTAREA')c.textContent=el.value;else if(el.tagName==='SELECT')[...c.options].forEach((o,j)=>o.toggleAttribute('selected',el.options[j].selected));else if(el.type!=='file'){c.setAttribute('value',el.value);c.toggleAttribute('checked',el.checked);}});
    [clone,...all('.teach-selected',clone)].forEach(e=>e.classList.remove('teach-selected'));
    all('[data-edit]',clone).forEach(e=>e.removeAttribute('contenteditable'));
    all('[data-slide]',clone).forEach(e=>e.removeAttribute('hidden'));
    all('[data-teach-controls],[data-teach-overlay]',clone).forEach(e=>e.remove());
    return clone;
  }
  const snapshot=()=>cleanCopy(root).innerHTML;
  function checkpoint() {
    clearTimeout(timer);const value=snapshot();
    if(history[cursor]!==value){history=history.slice(0,cursor+1);history.push(value);if(history.length>20)history.shift();cursor=history.length-1;}
    ui.querySelector('[data-cmd=undo]').disabled=cursor<1;
    ui.querySelector('[data-cmd=redo]').disabled=cursor>=history.length-1;
    ui.querySelector('[data-state]').textContent=value===saved?'변경 없음':'변경 사항 있음';
  }
  function updateNavigation(){if(slides){current=Math.max(0,Math.min(current,frames().length-1));ui.querySelector('[data-counter]').textContent=`${current+1} / ${frames().length}`;ui.querySelector('[data-cmd=prev]').disabled=current===0;ui.querySelector('[data-cmd=next]').disabled=current===frames().length-1;}}
  function refresh(){updateNavigation();if(slides)frames().forEach((p,i)=>p.hidden=presenting&&i!==current);prepare();syncInspector();}
  function reportBounds() {
    if(!slides||!valid(ctx.piece))return;
    const f=ctx.piece.closest('[data-slide]');if(!f)return;
    const a=ctx.piece.getBoundingClientRect(),b=f.getBoundingClientRect();
    if(a.left<b.left-2||a.top<b.top-2||a.right>b.right+2||a.bottom>b.bottom+2||ctx.piece.scrollHeight>ctx.piece.clientHeight+2)say('선택 영역의 내용이나 위치가 슬라이드 밖으로 나갑니다. 크기·글자·위치를 확인하세요.');
  }
  function change(fn){checkpoint();const anchor=ctx.anchor;const next=fn();refresh();choose(next instanceof Element?next:anchor);checkpoint();say('변경했습니다. HTML 저장으로 보관하세요.');reportBounds();}
  function restore(delta){if(gesture){cancelGesture();return;}if(delta<0)checkpoint();const at=cursor+delta;if(at<0||at>=history.length)return;cursor=at;root.innerHTML=history[cursor];ctx={};lastRange=null;refresh();checkpoint();say(delta<0?'이전 상태로 되돌렸습니다.':'변경을 다시 적용했습니다.');}
  function clonePiece(el){const copy=el.cloneNode(true),ids=new Map(),prefix='copy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);[copy,...all('[id]',copy)].forEach((n,i)=>{if(n.id){const old=n.id;ids.set(old,`${prefix}-${i}`);n.id=ids.get(old);}});[copy,...all('*',copy)].forEach(n=>{n.classList.remove('teach-selected');[...n.attributes].forEach(a=>{let v=a.value;if(['for','aria-labelledby','aria-describedby'].includes(a.name))v=v.split(' ').map(x=>ids.get(x)||x).join(' ');if(['href','xlink:href'].includes(a.name)&&v.startsWith('#')&&ids.has(v.slice(1)))v='#'+ids.get(v.slice(1));v=v.replace(/url\(#([^)]+)\)/g,(m,id)=>ids.has(id)?`url(#${ids.get(id)})`:m);if(v!==a.value)n.setAttribute(a.name,v);});});return copy;}
  function save(){const html='<!doctype html>\n'+cleanCopy(doc.documentElement).outerHTML,url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=doc.createElement('a');a.href=url;a.download=doc.body.dataset.teachFilename||'편집한_자료.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);saved=snapshot();checkpoint();ui.querySelector('[data-state]').textContent='다운로드 요청됨';say('현재 내용의 HTML 다운로드를 시작했습니다. 내려받은 파일을 확인하세요.');}
  function insert(node){const anchor=ctx.piece;if(valid(anchor)&&anchor!==active())anchor.after(node);else active().append(node);return node.matches('[data-edit]')?node:node.querySelector('[data-edit]')||node;}
  function loadImage(replace){const existing=replace?ctx.image:null,destination=ctx.piece,input=doc.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif';input.onchange=()=>{const file=input.files[0];if(!file)return;const reader=new FileReader();reader.onerror=()=>say('이미지를 읽지 못했습니다. 다른 파일로 다시 시도하세요.');reader.onload=()=>change(()=>{if(valid(existing)){existing.src=reader.result;return existing;}const figure=doc.createElement('figure');figure.dataset.piece='';const img=doc.createElement('img');img.src=reader.result;img.alt='추가한 이미지';img.style.maxWidth='100%';img.style.height='auto';const caption=doc.createElement('figcaption');caption.dataset.edit='';caption.textContent='이미지 설명';figure.append(img,caption);if(valid(destination)&&destination!==active())destination.after(figure);else active().append(figure);return img;});reader.readAsDataURL(file);};input.click();}
  function tableOperation(cmd){const table=ctx.table,cell=ctx.cell;if(!valid(table))return say('표 안의 셀을 먼저 누르세요.');if(merged(table))return say('병합된 셀을 보존하기 위해 이 표의 행·열 변경은 지원하지 않습니다.');
    const count=table.rows[0]?.cells.length||1,index=cell?.cellIndex;
    if(cmd==='row')return change(()=>{const group=cell?.parentElement.parentElement.tagName==='TBODY'?cell.parentElement.parentElement:table.tBodies[0]||table.createTBody(),at=cell&&cell.parentElement.parentElement===group?cell.parentElement.sectionRowIndex+1:-1,row=group.insertRow(at);for(let i=0;i<count;i++){const c=row.insertCell();c.dataset.edit='';c.innerHTML='<br>';}return row.cells[0];});
    if(cmd==='column')return change(()=>{const at=index==null?count:index+1;[...table.rows].forEach(row=>{const c=doc.createElement(row.parentElement.tagName==='THEAD'?'th':'td');c.dataset.edit='';c.innerHTML='<br>';row.insertBefore(c,row.cells[at]||null);});all('colgroup',table).forEach(g=>g.remove());return table.rows[0].cells[at];});
    if(!cell)return say('삭제할 셀을 먼저 선택하세요.');
    if(cmd==='delete-row'){const row=cell.parentElement;if(table.rows.length<2)return say('마지막 행은 남겨 둡니다.');if(hasContent(row)&&!confirm('선택한 행의 내용을 삭제할까요? 되돌리기로 복구할 수 있습니다.'))return;return change(()=>{const next=row.nextElementSibling||row.previousElementSibling;row.remove();return next?.cells[0]||table.rows[0]?.cells[0];});}
    if(count<2)return say('마지막 열은 남겨 둡니다.');const cells=[...table.rows].map(r=>r.cells[index]);if(cells.some(hasContent)&&!confirm('선택한 열의 내용을 삭제할까요? 되돌리기로 복구할 수 있습니다.'))return;
    change(()=>{cells.forEach(c=>c.remove());all('colgroup',table).forEach(g=>g.remove());return table.rows[0].cells[Math.min(index,count-2)];});
  }
  function setColumnWidth(value){const table=ctx.table;if(!valid(table)||!ctx.cell||merged(table))return;const cells=[...table.rows[0].cells];if(cells.length<2)return;const at=ctx.cell.cellIndex,total=cells.reduce((s,c)=>s+c.getBoundingClientRect().width,0),ratio=Math.min(95,Math.max(5,value)),old=cells.map(c=>c.getBoundingClientRect().width/total*100),remaining=100-old[at];
    const width=table.getBoundingClientRect().width/scale(table).x;all('colgroup',table).forEach(g=>g.remove());const group=doc.createElement('colgroup');old.forEach((v,i)=>{const col=doc.createElement('col');col.style.width=(i===at?ratio:(remaining>0?v/remaining:1/(cells.length-1))*(100-ratio))+'%';group.append(col);});const before=[...table.children].find(e=>e.tagName!=='CAPTION');table.insertBefore(group,before||null);Object.assign(table.style,{tableLayout:'fixed',width:`${width}px`,maxWidth:'100%',boxSizing:'border-box'});
  }
  function answerLines(){const el=ctx.answer,lines=+field('answer-lines').value,pitch=+field('answer-pitch').value;if(!valid(el))return;el.dataset.answerLines=lines;el.dataset.answerPitch=pitch;el.style.backgroundImage=lines?`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 99H100" stroke="#a9bdb2" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>')}")`:'none';el.style.backgroundSize=`100% ${pitch}mm`;el.style.backgroundRepeat='repeat-y';if(lines)Object.assign(el.style,{minHeight:`${lines*pitch}mm`,height:'auto',boxSizing:'border-box',lineHeight:`${pitch}mm`,overflow:'visible'});}
  function resizePiece(el,width,height){Object.assign(el.style,{boxSizing:'border-box',width:`${Math.max(24,width)}px`,height:`${Math.max(24,height)}px`,overflow:'visible'});if(el.matches('img'))el.style.height='auto';else if(ctx.image&&el.contains(ctx.image)){el.style.height='auto';ctx.image.style.width='100%';ctx.image.style.height='auto';}}
  function splitTranslate(value){if(!value||value==='none')return ['0px','0px'];let depth=0,part='',out=[];for(const c of value){if(c==='(')depth++;if(c===')')depth--;if(/\s/.test(c)&&!depth){if(part){out.push(part);part='';}}else part+=c;}if(part)out.push(part);return [out[0],out[1]||'0px',out[2]];}
  function translate(el,base,x,y){el.style.translate=`calc(${base[0]} + ${x}px) calc(${base[1]} + ${y}px)${base[2]?' '+base[2]:''}`;}
  function cancelGesture(){if(!gesture)return;const g=gesture;gesture=null;if(g.style===null)g.el.removeAttribute('style');else g.el.setAttribute('style',g.style);if(g.image){if(g.imageStyle===null)g.image.removeAttribute('style');else g.image.setAttribute('style',g.imageStyle);}if(g.handle.hasPointerCapture(g.id))g.handle.releasePointerCapture(g.id);syncInspector();say('이동·크기 변경을 취소했습니다.');}
  overlay.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-drag]');if(!handle||!editable||!valid(ctx.piece)||e.button!==0)return;e.preventDefault();checkpoint();const el=ctx.piece,s=scale(el.parentElement);gesture={el,handle,id:e.pointerId,mode:handle.dataset.drag,x:e.clientX,y:e.clientY,s,width:el.offsetWidth,height:el.offsetHeight,base:splitTranslate(getComputedStyle(el).translate),style:el.getAttribute('style'),image:ctx.image,imageStyle:ctx.image?.getAttribute('style')};handle.setPointerCapture(e.pointerId);});
  overlay.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;const x=(e.clientX-g.x)/g.s.x,y=(e.clientY-g.y)/g.s.y;if(g.mode==='move')translate(g.el,g.base,x,y);else resizePiece(g.el,g.width+x,g.height+y);drawOverlay();});
  overlay.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;g.handle.releasePointerCapture(e.pointerId);checkpoint();syncInspector();say('배치를 변경했습니다. 되돌리기로 복구할 수 있습니다.');reportBounds();});
  overlay.addEventListener('pointercancel',cancelGesture);
  overlay.addEventListener('keydown',e=>{const mode=e.target.dataset.drag;if(!mode||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?10:1,x=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,y=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;change(()=>{const el=ctx.piece;if(mode==='move')translate(el,splitTranslate(getComputedStyle(el).translate),x,y);else resizePiece(el,el.offsetWidth+x,el.offsetHeight+y);});});
  root.addEventListener('click',e=>{ui.querySelector('details').open=false;if(!gesture)choose(e.target);});
  root.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(checkpoint,250);say('편집 중 · HTML 저장으로 보관하세요.');drawOverlay();});
  root.addEventListener('paste',e=>{if(e.target.closest('[data-edit]')){e.preventDefault();doc.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}});
  doc.addEventListener('selectionchange',()=>{const s=getSelection();if(s.rangeCount&&root.contains(s.getRangeAt(0).commonAncestorContainer))lastRange=s.getRangeAt(0).cloneRange();});
  ui.addEventListener('mousedown',e=>{if(e.target.closest('[data-cmd=bold],[data-cmd=italic],[data-cmd=underline]'))e.preventDefault();});
  ui.addEventListener('change',e=>{const name=e.target.dataset.prop;if(!name||!editable)return;if(!e.target.checkValidity()){e.target.reportValidity();syncInspector();return;}const value=e.target.value;if(e.target.type==='number'&&!value.trim()){syncInspector();return;}
    change(()=>{const text=ctx.text;if(['font','font-size','line-height','align','color'].includes(name)&&valid(text)){const key={font:'fontFamily','font-size':'fontSize','line-height':'lineHeight',align:'textAlign',color:'color'}[name];text.style[key]=name==='font-size'?value+'pt':value;}
      else if(name==='column-width')setColumnWidth(+value);
      else if(name==='row-height'&&ctx.cell)ctx.cell.parentElement.style.height=value+'mm';
      else if(name==='image-width'&&valid(ctx.image))Object.assign(ctx.image.style,{width:value+'px',height:'auto',maxWidth:'100%'});
      else if(name==='image-alt'&&valid(ctx.image))ctx.image.alt=value;
      else if(name==='answer-height'&&valid(ctx.answer))Object.assign(ctx.answer.style,{minHeight:value+'mm',height:'auto',boxSizing:'border-box',overflow:'visible'});
      else if(['answer-lines','answer-pitch'].includes(name))answerLines();
      else if(['piece-width','piece-height'].includes(name)&&valid(ctx.piece))resizePiece(ctx.piece,+field('piece-width').value,+field('piece-height').value);
    });
  });
  ui.addEventListener('click',e=>{const cmd=e.target.closest('[data-cmd]')?.dataset.cmd;if(!cmd)return;
    if(cmd==='save')return save();if(cmd==='print')return print();if(cmd==='undo'||cmd==='redo')return restore(cmd==='undo'?-1:1);
    if(cmd==='inspector'){const panel=ui.querySelector('.teach-inspector');panel.hidden=!panel.hidden;e.target.textContent=panel.hidden?'도구 펼치기':'도구 접기';return;}
    if(cmd==='mode'||cmd==='present'){cancelGesture();editable=cmd==='mode'?!editable:presenting;presenting=cmd==='present'?!presenting:false;choose(null);ui.querySelector('[data-cmd=mode]').textContent=editable?'미리보기':'편집하기';if(slides)ui.querySelector('[data-cmd=present]').textContent=presenting?'발표 끝내기':'발표 보기';refresh();return;}
    if(cmd==='prev'||cmd==='next'){current+=cmd==='next'?1:-1;choose(null);refresh();if(!presenting)active()?.scrollIntoView({block:'start'});return;}
    if(!editable)return say('편집하기를 켠 뒤 수정하세요.');
    ui.querySelector('details').open=false;
    if(['bold','italic','underline'].includes(cmd)){if(!valid(ctx.text))return;change(()=>{if(lastRange&&!lastRange.collapsed&&lastRange.startContainer.isConnected&&lastRange.endContainer.isConnected){const s=getSelection();s.removeAllRanges();s.addRange(lastRange);doc.execCommand(cmd);}else{const style=getComputedStyle(ctx.text),key={bold:'fontWeight',italic:'fontStyle',underline:'textDecoration'}[cmd];ctx.text.style[key]=cmd==='bold'?(+style.fontWeight>=600?'400':'700'):cmd==='italic'?(style.fontStyle==='italic'?'normal':'italic'):(style.textDecorationLine.includes('underline')?'none':'underline');}});return;}
    if(cmd==='image'||cmd==='replace-image')return loadImage(cmd==='replace-image');
    if(cmd==='text'||cmd==='answer'||cmd==='table')return change(()=>{let node;if(cmd==='table'){node=doc.createElement('section');node.dataset.piece='';node.innerHTML='<table style="width:100%;border-collapse:collapse"><thead><tr><th data-edit style="border:1px solid #b8c9bf;padding:8px">항목</th><th data-edit style="border:1px solid #b8c9bf;padding:8px">내용</th></tr></thead><tbody><tr><td data-edit style="border:1px solid #b8c9bf;padding:8px"><br></td><td data-edit style="border:1px solid #b8c9bf;padding:8px"><br></td></tr></tbody></table>';}else{node=doc.createElement('div');node.dataset.piece='';node.dataset.edit='';if(cmd==='answer'){node.dataset.answerSpace='';Object.assign(node.style,{minHeight:'32mm',border:'1px solid #b8c9bf',padding:'8px',boxSizing:'border-box'});}else node.textContent='새 질문이나 설명을 입력하세요.';}return insert(node);});
    if(cmd.endsWith('-slide')){const frame=frames()[current];if(!frame)return;if(cmd==='copy-slide')return change(()=>{const c=clonePiece(frame);frame.after(c);current++;return c.querySelector('[data-edit]');});if(cmd==='delete-slide'){if(frames().length<2)return say('마지막 장은 남겨 둡니다.');if(confirm('현재 장을 삭제할까요? 되돌리기로 복구할 수 있습니다.'))change(()=>frame.remove());return;}const other=frames()[current+(cmd==='down-slide'?1:-1)];if(other)change(()=>{if(cmd==='down-slide'){other.after(frame);current++;}else{other.before(frame);current--;}});return;}
    if(['row','column','delete-row','delete-column'].includes(cmd))return tableOperation(cmd);
    if(!valid(ctx.piece))return say('수정할 영역을 먼저 선택하세요.');
    if(cmd==='copy')return change(()=>{const copy=clonePiece(ctx.piece);ctx.piece.after(copy);return copy.querySelector('[data-edit]')||copy;});
    if(cmd==='delete'){if(confirm('선택한 영역을 삭제할까요? 되돌리기로 복구할 수 있습니다.'))change(()=>ctx.piece.remove());return;}
    const el=ctx.piece,other=cmd==='up'?el.previousElementSibling:cmd==='down'?el.nextElementSibling:null;if(other)change(()=>cmd==='up'?other.before(el):other.after(el));
  });
  doc.addEventListener('keydown',e=>{
    if(e.key==='Escape'){cancelGesture();ui.querySelector('details').open=false;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&e.target.closest('[data-edit]')){e.preventDefault();const r=doc.createRange();r.selectNodeContents(e.target.closest('[data-edit]'));const s=getSelection();s.removeAllRanges();s.addRange(r);}
    const editingControl=ui.contains(e.target)&&e.target.matches('input,textarea,select');
    if((e.ctrlKey||e.metaKey)&&!editingControl&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();restore(e.shiftKey||e.key.toLowerCase()==='y'?1:-1);}
    if(presenting&&!e.target.closest('input,textarea,[contenteditable=true]')&&['ArrowLeft','ArrowRight'].includes(e.key)){current+=e.key==='ArrowRight'?1:-1;refresh();}
  });
  addEventListener('scroll',drawOverlay,true);addEventListener('resize',drawOverlay);
  addEventListener('beforeprint',()=>{cancelGesture();all('[data-slide]').forEach(e=>e.hidden=false);doc.activeElement?.blur();});addEventListener('afterprint',refresh);
  refresh();saved=snapshot();checkpoint();window.__teachFreeform={save};
})();
