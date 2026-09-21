/* 수식의 원문과 렌더 결과를 함께 보존한다. */
window.__teachCreateMathEditor = function (api) {
  'use strict';
  const {root, editable, change, insert, choose, valid, say}=api;
  const doc=root.ownerDocument, katex=window.__teachKaTeX, cache=new WeakMap();
  doc.querySelectorAll('[data-teach-math-ui]').forEach(e=>e.remove());
  const dialog=doc.createElement('dialog');
  dialog.dataset.teachMathUi='';dialog.className='teach-math-dialog';
  dialog.setAttribute('aria-label','수식 편집');
  dialog.innerHTML=`<div class="teach-math-heading"><h2>수식 편집</h2><button type="button" data-math-action="cancel" aria-label="수식 편집 닫기">닫기</button></div>
    <p class="teach-math-help">원문을 고치면 아래에서 바로 확인할 수 있습니다. 변경은 ‘적용’을 눌러야 문서에 반영됩니다.</p>
    <div class="teach-math-presets" aria-label="자주 쓰는 수식"></div>
    <details><summary>더 많은 수식</summary><div class="teach-math-more"></div></details>
    <label class="teach-math-source-label">LaTeX 수식<textarea data-math-source aria-label="LaTeX 수식" spellcheck="false" maxlength="10000" rows="4"></textarea></label>
    <label class="teach-math-layout">배치 <select data-math-display aria-label="수식 배치"><option value="block">별도 줄</option><option value="inline">문장 안</option></select></label>
    <p class="teach-math-position"></p><div class="teach-math-preview" data-math-preview aria-label="수식 미리보기"></div>
    <p class="teach-math-error" data-math-error role="status" aria-live="polite"></p>
    <div class="teach-math-actions"><span>Ctrl+Enter로 적용 · Esc로 취소</span><button type="button" data-math-action="cancel">취소</button><button type="button" data-math-action="apply">적용</button></div>`;
  doc.body.append(dialog);
  const input=dialog.querySelector('[data-math-source]'), display=dialog.querySelector('[data-math-display]'), preview=dialog.querySelector('[data-math-preview]'), error=dialog.querySelector('[data-math-error]'), apply=dialog.querySelector('[data-math-action=apply]');
  const templates=[['분수','\\frac{a}{b}'],['제곱근','\\sqrt{x}'],['위첨자','x^{2}'],['아래첨자','a_{n}'],['연립식','\\begin{cases}x+y=3\\\\x-y=1\\end{cases}'],['행렬','\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}'],['합','\\sum_{k=1}^{n} k'],['적분','\\int_{0}^{1} x^2\\,dx'],['벡터','\\vec{v}'],['여러 줄 풀이','\\begin{aligned}2x+3&=11\\\\2x&=8\\\\x&=4\\end{aligned}']];
  templates.forEach(([label,tex],i)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.dataset.mathTemplate=String(i);b.addEventListener('click',()=>{const at=input.selectionStart;input.setRangeText(tex,at,input.selectionEnd,'end');input.focus();const first=tex.indexOf('{');if(first>=0&&!tex.startsWith('\\begin'))input.setSelectionRange(at+first+1,at+first+2);update();});dialog.querySelector(i<4?'.teach-math-presets':'.teach-math-more').append(b);});
  let pending=null, previousFocus=null, debounce;
  const options=block=>({displayMode:block,throwOnError:true,trust:false,strict:'ignore',maxExpand:1000,maxSize:20,output:'htmlAndMathml',macros:{}});
  function rendered(tex, mode){if(!tex.trim())throw new Error('수식을 입력하세요.');if(tex.length>10000)throw new Error('수식을 짧게 나누어 입력하세요.');return katex.renderToString(tex,options(mode==='block'));}
  function update(){clearTimeout(debounce);try{preview.innerHTML=rendered(input.value,display.value);error.textContent='';apply.disabled=false;return true;}catch(e){preview.replaceChildren();error.textContent='수식을 확인해 주세요. '+e.message;apply.disabled=true;return false;}}
  function rangeInside(range){if(!range||!root.contains(range.commonAncestorContainer))return null;const start=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement,end=range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement,host=start.closest('[data-edit]');return host&&host===end.closest('[data-edit]')&&!start.closest('[data-math]')&&!end.closest('[data-math]')?range.cloneRange():null;}
  function open(target=null, range=null){
    if(!editable()||dialog.open)return;
    previousFocus=doc.activeElement;pending={target:valid(target)?target:null,range:rangeInside(range)};
    input.value=pending.target?.dataset.latex||'x^2';
    display.value=pending.target?.dataset.display||(pending.range?'inline':'block');
    display.querySelector('[value=inline]').disabled=!pending.target&&!pending.range;
    dialog.querySelector('.teach-math-position').textContent=pending.range?'선택한 글 위치에 넣습니다.':pending.target?'현재 수식의 위치에서 고칩니다.':'문장 안에 넣으려면 글에서 위치를 선택한 뒤 ‘수식’을 누르세요.';
    update();dialog.showModal();input.focus();input.select();
  }
  function commit(){
    if(!pending||!update())return;
    const state=pending,tex=input.value,mode=display.value,html=preview.innerHTML;
    if(state.target&&!valid(state.target)){error.textContent='원래 수식이 없어졌습니다. 취소 후 다시 선택하세요.';return;}
    if(state.range&&!root.contains(state.range.commonAncestorContainer)){error.textContent='넣을 위치가 바뀌었습니다. 취소 후 다시 선택하세요.';return;}
    dialog.close();
    let node;
    change(()=>{node=state.target||doc.createElement('span');node.dataset.math='';node.dataset.latex=tex;node.dataset.display=mode;node.innerHTML=html;cache.delete(node);
      if(!state.target){node.dataset.piece='';if(mode==='inline'&&state.range){state.range.deleteContents();state.range.insertNode(node);}else insert(node);}return node;});
    previousFocus=node;node.focus();say('수식을 적용했습니다. HTML 저장으로 보관하세요.');
  }
  input.addEventListener('input',()=>{clearTimeout(debounce);apply.disabled=true;debounce=setTimeout(update,120);});display.addEventListener('change',update);
  dialog.addEventListener('click',e=>{const action=e.target.closest('[data-math-action]')?.dataset.mathAction;if(action==='apply')commit();else if(action==='cancel')dialog.close();});
  dialog.addEventListener('keydown',e=>{e.stopPropagation();if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();commit();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();error.textContent='먼저 적용한 뒤 문서의 HTML 저장을 눌러 주세요.';}});
  dialog.addEventListener('close',()=>{clearTimeout(debounce);pending=null;if(previousFocus?.isConnected)previousFocus.focus();});
  function prepare(){root.querySelectorAll('[data-math]').forEach(el=>{const tex=el.dataset.latex||'',mode=el.dataset.display||'inline',key=JSON.stringify([tex,mode]);el.contentEditable='false';el.tabIndex=0;el.setAttribute('role','math');el.setAttribute('aria-label',tex);el.title='클릭하거나 Enter를 눌러 수식 편집';if(cache.get(el)===key)return;try{el.innerHTML=rendered(tex,mode);el.removeAttribute('data-math-invalid');}catch(e){el.textContent=tex||'수식 입력';el.dataset.mathInvalid='';}cache.set(el,key);});}
  root.addEventListener('click',e=>{const el=e.target.closest('[data-math]');if(el&&editable()&&getSelection().isCollapsed){e.preventDefault();choose(el);open(el);}});
  root.addEventListener('keydown',e=>{const el=e.target.closest('[data-math]');if(el&&editable()&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();choose(el);open(el);}});
  return {open,prepare,contains:el=>dialog.contains(el),isOpen:()=>dialog.open};
};
