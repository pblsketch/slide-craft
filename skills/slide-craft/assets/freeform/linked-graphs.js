/* Numeric expressions are parsed, never executed as JavaScript. */
window.__teachGraphs = (() => {
  'use strict';
  const parameters = ['a', 'b', 'c', 'k'];
  const functions = {sin:Math.sin, cos:Math.cos, tan:Math.tan, sqrt:Math.sqrt, abs:Math.abs, exp:Math.exp, ln:Math.log, log:Math.log10};
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cache = new WeakMap();
  function compile(source) {
    if(source.length > 1500) throw new Error('그래프 수식은 1,500자 이내로 입력하세요.');
    let text=source.trim().replace(/^(?:y|f\s*\(\s*x\s*\))\s*=/,'').replace(/\\(?:left|right)\b/g,'').replace(/\\(?:cdot|times)\b/g,'*').replace(/\\(?:,|;|!|quad\b|qquad\b)/g,' ').replace(/[−–]/g,'-').replace(/π/g,'pi');
    const tokens=[];
    while(text.trim()) {
      text=text.trimStart(); let match;
      if((match=text.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/))) tokens.push({number:+match[0]});
      else if((match=text.match(/^\\([A-Za-z]+)|^([A-Za-z]+)/))) {
        const word=match[1]||match[2];
        if(Object.hasOwn(functions,word) || ['frac','pi','x','e',...parameters].includes(word)) tokens.push(word);
        else if(!match[1]&&/^[xabcke]+$/.test(word))tokens.push(...word);
        else throw new Error(`그래프에서 지원하지 않는 기호: ${word}`);
      } else if((match=text.match(/^[+\-*/^(){}]/))) tokens.push(match[0]);
      else throw new Error('그래프는 y=f(x) 형태로 입력하세요. 분수·근호는 중괄호로 묶어 주세요.');
      text=text.slice(match[0].length);
      if(tokens.length>500)throw new Error('수식을 짧게 나누어 주세요.');
    }
    let at=0, depth=0;const used=new Set();
    const peek=()=>tokens[at];
    function primary(){
      if(++depth>60)throw new Error('괄호 중첩이 너무 깊습니다.');
      const token=tokens[at++];let node;
      if(token&&typeof token==='object')node={type:'number',value:token.number};
      else if(token==='('||token==='{'){
        node=add();if(tokens[at++]!==(token==='('?')':'}'))throw new Error('괄호의 짝을 확인하세요.');
      } else if(token==='frac')node={type:'/',left:primary(),right:primary()};
      else if(Object.hasOwn(functions,token)){if(peek()!=='('&&peek()!=='{')throw new Error('함수의 인수는 괄호로 묶어 주세요. 예: sin(x), sqrt(x)');node={type:'function',name:token,arg:primary()};}
      else if(['x','e','pi',...parameters].includes(token)){used.add(token);node={type:'variable',name:token};}
      else throw new Error('숫자·x·함수 또는 괄호 안의 식이 필요합니다.');
      depth--;return node;
    }
    function power(){const left=primary();return peek()==='^'?(at++,{type:'^',left,right:unary()}):left;}
    function unary(){if(peek()==='+'||peek()==='-'){const sign=tokens[at++];return {type:'unary',sign,arg:unary()};}return power();}
    const startsPrimary=t=>t&&typeof t==='object'||t==='('||t==='{'||typeof t==='string'&&(/^[A-Za-z]+$/.test(t));
    function multiply(){let node=unary();while(peek()==='*'||peek()==='/'||startsPrimary(peek())){const op=peek()==='/'?'/':'*';if(peek()==='*'||peek()==='/')at++;node={type:op,left:node,right:unary()};}return node;}
    function add(){let node=multiply();while(peek()==='+'||peek()==='-'){const type=tokens[at++];node={type,left:node,right:multiply()};}return node;}
    const tree=add();if(at!==tokens.length)throw new Error('수식 끝의 기호와 괄호를 확인하세요.');
    function value(node,x,params){
      if(node.type==='number')return node.value;
      if(node.type==='variable')return node.name==='x'?x:node.name==='pi'?Math.PI:node.name==='e'?Math.E:params[node.name];
      if(node.type==='function')return functions[node.name](value(node.arg,x,params));
      if(node.type==='unary')return (node.sign==='-'?-1:1)*value(node.arg,x,params);
      const a=value(node.left,x,params),b=value(node.right,x,params);
      return node.type==='+'?a+b:node.type==='-'?a-b:node.type==='*'?a*b:node.type==='/'?a/b:Math.pow(a,b);
    }
    return {evaluate:(x,p={})=>value(tree,x,{a:1,b:0,c:0,k:1,...p}),parameters:parameters.filter(p=>used.has(p))};
  }
  function config(raw={}){
    const c={xmin:-5,xmax:5,ymin:-5,ymax:5,parameters:{a:1,b:0,c:0,k:1},...raw};c.parameters={a:1,b:0,c:0,k:1,...raw.parameters};
    for(const key of ['xmin','xmax','ymin','ymax'])if(!Number.isFinite(c[key])||Math.abs(c[key])>1e6)throw new Error('축 범위는 유한한 숫자로 입력하세요.');
    if(c.xmin>=c.xmax||c.ymin>=c.ymax)throw new Error('축의 최댓값은 최솟값보다 커야 합니다.');
    for(const p of parameters)if(!Number.isFinite(c.parameters[p])||Math.abs(c.parameters[p])>1e6)throw new Error('계수 값을 확인하세요.');
    return c;
  }
  const number=n=>Number(n.toPrecision(4)).toString();
  const X=60,Y=28,W=510,H=260;
  function start(title){return `<svg data-linked-svg="" viewBox="0 0 640 340" role="img" aria-label="${escape(title)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font:13px Arial;fill:#426070">`;}
  function axes(c,xLabel='x',yLabel='y',functionAxes=true){
    const px=x=>X+(x-c.xmin)/(c.xmax-c.xmin)*W,py=y=>Y+(c.ymax-y)/(c.ymax-c.ymin)*H;
    const x0=px(Math.max(c.xmin,Math.min(c.xmax,0))),y0=py(Math.max(c.ymin,Math.min(c.ymax,0)));
    const ticks=(min,max)=>{const raw=(max-min)/5,scale=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].find(v=>v*scale>=raw)*scale,out=[];for(let v=Math.ceil(min/step)*step;v<=max+step/100&&out.length<30;v+=step)out.push(Math.abs(v)<step/100?0:v);return out;};
    let svg='';
    for(const x of ticks(c.xmin,c.xmax))svg+=`<path d="M${px(x)} ${Y}V${Y+H}" stroke="#dce5e8" fill="none"/><text x="${px(x)}" y="${functionAxes?y0+18:Y+H+21}" text-anchor="middle">${number(x)}</text>`;
    for(const y of ticks(c.ymin,c.ymax))svg+=`<path d="M${X} ${py(y)}H${X+W}" stroke="#dce5e8" fill="none"/>`+((functionAxes&&y===0)?'':`<text x="${functionAxes?x0-10:X-10}" y="${py(y)+4}" text-anchor="end">${number(y)}</text>`);
    svg+=`<path d="M${X} ${y0}H${X+W} M${x0} ${Y}V${Y+H}" stroke="#637e8b" fill="none"/><text x="${X+W}" y="335" text-anchor="end">${escape(xLabel)}</text><text x="${X}" y="18">${escape(yLabel)}</text>`;
    return {svg,px,py};
  }
  function clipped(a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1;
    for(const [p,q] of [[-dx,a[0]-X],[dx,X+W-a[0]],[-dy,a[1]-Y],[dy,Y+H-a[1]]]){
      if(p===0){if(q<0)return null;continue;}const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return null;
    }
    return [[a[0]+lo*dx,a[1]+lo*dy],[a[0]+hi*dx,a[1]+hi*dy]];
  }
  function functionPlot(tex,raw){
    const c=config(raw),f=compile(tex),{svg,px,py}=axes(c);let d='',previous=null,finite=0;
    const span=c.ymax-c.ymin;
    for(let i=0;i<=800;i++){
      const x=c.xmin+(c.xmax-c.xmin)*i/800,y=f.evaluate(x,c.parameters);
      if(!Number.isFinite(y)||y<c.ymin-2*span||y>c.ymax+2*span){previous=null;continue;}
      finite++;const point=[px(x),py(y)];
      if(previous&&Math.abs(previous[1]-point[1])<H*.8){const pair=clipped(previous,point);if(pair)d+=`M${pair[0][0].toFixed(2)} ${pair[0][1].toFixed(2)}L${pair[1][0].toFixed(2)} ${pair[1][1].toFixed(2)}`;}
      previous=point;
    }
    if(finite<2||!d)throw new Error('현재 축 범위에서 그릴 수 있는 실수 값이 없습니다. 범위를 조정하세요.');
    return {svg:start(tex)+svg+`<path data-function-curve="" d="${d}" stroke="#1b6879" stroke-width="2.3" fill="none"/></svg>`,config:c,parameters:f.parameters};
  }
  function readTable(group){
    const table=group.querySelector('[data-chart-table]');if(!table)throw new Error('연결된 데이터 표가 없습니다.');
    if(table.querySelector('[rowspan]:not([rowspan="1"]),[colspan]:not([colspan="1"])'))throw new Error('연결 데이터 표는 병합하지 않은 셀을 사용하세요.');
    const rows=[...table.rows];if(rows.length<2)throw new Error('데이터 행을 한 개 이상 입력하세요.');
    const names=[...rows[0].cells].slice(1).map(c=>c.textContent.trim());
    if(!names.length||names.length>4||names.some(n=>!n))throw new Error('값 열은 이름이 있는 1~4개를 사용하세요.');
    if(rows.length>31)throw new Error('데이터는 30행 이내로 나누어 주세요.');
    const values=rows.slice(1).map((r,i)=>{
      if(r.cells.length!==names.length+1)throw new Error('표의 열 수를 맞춰 주세요.');
      const label=r.cells[0].textContent.trim();if(!label)throw new Error(`${i+1}번째 항목 이름을 입력하세요.`);
      const numbers=[...r.cells].slice(1).map(cell=>{const s=cell.textContent.trim().replace(/,/g,'');if(!s||!Number.isFinite(Number(s))||Math.abs(Number(s))>1e9)throw new Error(`${i+1}번째 행의 값을 숫자로 입력하세요.`);return Number(s);});
      return {label,numbers};
    });
    return {names,values};
  }
  const colors=['#267597','#a65b37','#7658a0','#506b60'];
  function dataPlot(group){
    const data=readTable(group),line=group.dataset.chartType==='line',all=data.values.flatMap(r=>r.numbers);
    let ymin=Math.min(0,...all),ymax=Math.max(0,...all);if(ymin===ymax)ymax=ymin+1;
    const padding=(ymax-ymin)*.08;if(ymin<0)ymin-=padding;if(ymax>0)ymax+=padding;
    const numeric=line&&data.values.every(r=>r.label!==''&&Number.isFinite(Number(r.label)));
    const xs=data.values.map((r,i)=>numeric?Number(r.label):i);
    if(numeric&&xs.some(x=>Math.abs(x)>1e9))throw new Error('숫자 x값의 절댓값은 10억 이하로 입력하세요.');
    if(numeric&&xs.some((x,i)=>i&&x<=xs[i-1]))throw new Error('꺾은선의 숫자 x값은 작은 값부터 중복 없이 입력하세요.');
    const xmin=line?xs[0]-.5:0,xmax=line?xs.at(-1)+.5:data.values.length;
    const c={xmin,xmax,ymin,ymax},a=axes(c,group.dataset.chartXLabel||'',group.dataset.chartYLabel||'값',false);
    // Use category labels instead of numeric x ticks for tables.
    let svg=start('데이터 표와 연결된 그래프').replace('640 340','640 370')+a.svg.replace(/<text x="[^"]+" y="309"[^>]*>.*?<\/text>/g,'');
    const px=(x)=>X+(x-xmin)/(xmax-xmin)*W;
    data.values.forEach((r,i)=>{const x=line?px(xs[i]):X+(i+.5)/data.values.length*W;svg+=`<text x="${x}" y="310" text-anchor="middle"><title>${escape(r.label)}</title>${escape(r.label.slice(0,Math.max(1,Math.min(12,Math.floor(W/data.values.length/14)))))}</text>`;});
    data.names.forEach((name,j)=>{
      if(line){const points=data.values.map((r,i)=>`${px(xs[i])},${a.py(r.numbers[j])}`).join(' ');svg+=`<polyline data-series="${j}" points="${points}" stroke="${colors[j]}" stroke-width="2.3" fill="none"/>`;}
      data.values.forEach((r,i)=>{const value=r.numbers[j],y=a.py(value);
        if(line)svg+=`<circle data-chart-value="${value}" cx="${px(xs[i])}" cy="${y}" r="3.5" fill="${colors[j]}"/>`;
        else{const width=W/data.values.length*.7/data.names.length,x=X+(i+.15)*W/data.values.length+j*width;svg+=`<rect data-chart-value="${value}" x="${x}" y="${Math.min(y,a.py(0))}" width="${width-2}" height="${Math.abs(a.py(0)-y)}" fill="${colors[j]}"/>`;}
      });
      svg+=`<text x="${X+j*125}" y="360" fill="${colors[j]}">${escape(name.slice(0,10))}</text>`;
    });
    return svg+'</svg>';
  }
  function configOf(group){try{return config(JSON.parse(group.dataset.graphConfig||'{}'));}catch(e){throw new Error('그래프 축 범위와 계수 설정을 확인하세요. '+e.message);}}
  function renderGroup(group){
    const isFunction=group.hasAttribute('data-function-graph'),formula=group.querySelector('[data-math]');
    let canvas=group.querySelector(':scope > [data-graph-canvas]');if(!canvas){canvas=document.createElement('span');canvas.dataset.graphCanvas='';canvas.contentEditable='false';group.append(canvas);}
    let status=group.querySelector(':scope > [data-graph-status]');if(!status){status=document.createElement('span');status.dataset.graphStatus='';status.setAttribute('role','status');group.append(status);}status.contentEditable='false';
    try{
      const key=isFunction?JSON.stringify([formula?.dataset.latex,group.dataset.graphConfig]):JSON.stringify([readTable(group),group.dataset.chartType,group.dataset.chartXLabel,group.dataset.chartYLabel]);
      if(cache.get(group)===key)return true;
      let svg,caption='';
      if(isFunction){if(!formula||group.querySelectorAll('[data-math]').length!==1)throw new Error('그래프 한 개에는 수식 한 개를 연결하세요.');const result=functionPlot(formula.dataset.latex,configOf(group));svg=result.svg;caption=result.parameters.map(p=>`${p} = ${result.config.parameters[p]}`).join(' · ');}
      else svg=dataPlot(group);
      canvas.innerHTML=svg;status.textContent=caption;group.removeAttribute('data-graph-invalid');cache.set(group,key);return true;
    }catch(e){group.dataset.graphInvalid='';status.textContent='그래프를 갱신하지 못했습니다. '+e.message;cache.delete(group);return false;}
  }
  function prepare(root){let ok=true;root.querySelectorAll('[data-function-graph],[data-data-chart]').forEach(g=>{if(!renderGroup(g))ok=false;});return ok;}
  return {compile,config,functionPlot,configOf,readTable,dataPlot,prepare,parameters};
})();
