import{initializeApp}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import{getFirestore,doc,getDoc,collection,onSnapshot,query,orderBy,addDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const cfg={apiKey:"AIzaSyAufmht7zvxG_8fwUeb59NBENppnt-MlhY",authDomain:"setor-de-fadiga.firebaseapp.com",projectId:"setor-de-fadiga",storageBucket:"setor-de-fadiga.firebasestorage.app",messagingSenderId:"843558361497",appId:"1:843558361497:web:54db0e57a70bcb0eb9db08"};
const fb=initializeApp(cfg),auth=getAuth(fb),db=getFirestore(fb),$=s=>document.querySelector(s);
let rel=[],pen=[],ciencias=[],perfil=null,user=null,relAtual=null;
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dataBR=v=>{if(!v)return"-";let[y,m,d]=v.split("-");return`${d}/${m}/${y}`};
const tsBR=t=>{try{return t?.toDate().toLocaleString("pt-BR")||"-"}catch{return"-"}};

$("#entrar").onclick=async()=>{try{$("#loginMsg").textContent="";await signInWithEmailAndPassword(auth,$("#email").value.trim(),$("#senha").value)}catch{$("#loginMsg").textContent="Não foi possível entrar. Verifique e-mail e senha."}};
$("#sair").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async u=>{
 if(!u){user=null;$("#login").classList.remove("hidden");$("#app").classList.add("hidden");return}
 user=u; const s=await getDoc(doc(db,"usuarios",u.uid));
 if(!s.exists()||s.data().ativo!==true){await signOut(auth);return}
 perfil=s.data();
 if(!["administrador","gestor"].includes(perfil.perfil)){ $("#loginMsg").textContent="Este acesso é exclusivo da gestão.";await signOut(auth);return}
 $("#userBadge").textContent=`${perfil.nome||"Gestão"} • ${perfil.perfil}`;
 $("#login").classList.add("hidden");$("#app").classList.remove("hidden");escutar();
});

function escutar(){
 onSnapshot(query(collection(db,"relatorios"),orderBy("createdAt","desc")),s=>{rel=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()});
 onSnapshot(collection(db,"pendencias"),s=>{pen=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()});
 onSnapshot(collection(db,"ciencia_gestao"),s=>{ciencias=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()});
}

document.querySelectorAll(".nav[data-page]").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("on"));b.classList.add("on");
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));$("#page-"+b.dataset.page).classList.add("active");renderAll();
});
["#dIni","#dFim","#fTurno","#fResp","#rData","#rTurno","#rResp","#rSit","#rBusca","#pStatus","#pTurno","#pBusca"].forEach(id=>$(id).addEventListener("input",renderAll));
$("#limpar").onclick=()=>{$("#dIni").value=$("#dFim").value=$("#fTurno").value=$("#fResp").value="";renderAll()};

function dashFilter(r){return(!$("#dIni").value||r.dataTurno>=$("#dIni").value)&&(!$("#dFim").value||r.dataTurno<=$("#dFim").value)&&(!$("#fTurno").value||r.turno==$("#fTurno").value)&&(!$("#fResp").value||r.responsavelNome==$("#fResp").value)}
function relFiltrados(){let q=norm($("#rBusca").value);return rel.filter(r=>(!$("#rData").value||r.dataTurno==$("#rData").value)&&(!$("#rTurno").value||r.turno==$("#rTurno").value)&&(!$("#rResp").value||r.responsavelNome==$("#rResp").value)&&(!$("#rSit").value||norm(r.situacao)==$("#rSit").value)&&(!q||norm(JSON.stringify(r)).includes(q)))}

function renderAll(){
 let a=rel.filter(dashFilter),n=a.filter(x=>norm(x.situacao)=="NORMAL").length,at=a.filter(x=>norm(x.situacao)=="ATENCAO").length,oc=a.filter(x=>norm(x.situacao)=="OCORRENCIA").length;
 $("#kRel").textContent=a.length;$("#kNor").textContent=n;$("#kAte").textContent=at;$("#kOco").textContent=oc;$("#kPen").textContent=pen.filter(x=>norm(x.status)=="ABERTA").length;
 let vals=[["Normal",n,"greenFill"],["Atenção",at,"orangeFill"],["Ocorrência",oc,"redFill"],["Total",a.length,"totalFill"]],mx=Math.max(1,...vals.map(x=>x[1]));
 $("#bars").innerHTML=vals.map(x=>`<div class="barrow"><b>${x[0]}</b><div class="bar"><div class="fill ${x[2]}" style="width:${x[1]/mx*100}%"></div></div><b>${x[1]}</b></div>`).join("");
 $("#recentes").innerHTML=a.slice(0,5).map(cardRel).join("")||"<p>Nenhum relatório no filtro.</p>";
 let sn=a.filter(x=>norm(x.sistemaFadiga)=="NORMAL").length,si=a.filter(x=>norm(x.sistemaFadiga)=="INSTAVEL").length,sd=a.filter(x=>norm(x.sistemaFadiga)=="INDISPONIVEL").length;
 $("#systemStats").innerHTML=`<div class="miniStats"><span><b>${sn}</b> Normal</span><span><b>${si}</b> Instável</span><span><b>${sd}</b> Indisponível</span></div>`;
 renderRel();renderPen();bind();
}

function cardRel(r){
 let s=norm(r.situacao),c=s=="OCORRENCIA"?"red":s=="NORMAL"?"green":"",ci=ciencias.find(x=>x.relatorioId==r.id);
 return`<div class="item ${c}"><span class="tag ${c}">${s||"-"}</span><h3>${esc(r.responsavelNome)} • Turno ${esc(r.turno)}</h3><div class="meta">${dataBR(r.dataTurno)} • ${esc(r.horario)}</div><p>${esc(r.resumo||"Sem resumo")}</p>${ci?`<div class="science">✓ Ciência: ${esc(ci.gestorNome)} • ${tsBR(ci.createdAt)}</div>`:""}<button class="action view" data-id="${r.id}">Visualizar completo</button></div>`
}
function renderRel(){let a=relFiltrados();$("#listaRel").innerHTML=a.map(cardRel).join("")||"<p>Nenhum relatório encontrado.</p>"}
function renderPen(){
 let q=norm($("#pBusca").value),a=pen.filter(p=>(!$("#pStatus").value||norm(p.status)==$("#pStatus").value)&&(!$("#pTurno").value||p.turnoOrigem==$("#pTurno").value)&&(!q||norm(JSON.stringify(p)).includes(q)));
 $("#listaPen").innerHTML=a.map(p=>{let ci=ciencias.find(x=>x.pendenciaId==p.id);return`<div class="item"><span class="tag">${norm(p.status)}</span><h3>Pendência</h3><div class="meta">Origem: ${esc(p.openedByNome||"-")} • Turno ${esc(p.turnoOrigem||"-")} • Abertura: ${tsBR(p.openedAt)}</div><p>${esc(p.descricao||"-")}</p>${ci?`<div class="science">✓ Ciência da gestão: ${esc(ci.gestorNome)} • ${tsBR(ci.createdAt)}</div>`:`<button class="action sciencePen" data-id="${p.id}">✓ Dar ciência</button>`}</div>`}).join("")||"<p>Nenhuma pendência encontrada.</p>"
}
function bind(){
 document.querySelectorAll(".view").forEach(b=>b.onclick=()=>abrir(rel.find(x=>x.id==b.dataset.id)));
 document.querySelectorAll(".sciencePen").forEach(b=>b.onclick=()=>darCienciaPendencia(b.dataset.id));
}
function det(a,b){return`<div class="detail"><b>${a}</b><br>${esc(b||"-")}</div>`}
function abrir(r){
 if(!r)return;relAtual=r;let ci=ciencias.find(x=>x.relatorioId==r.id);
 $("#modalBody").innerHTML=`<div class="eyebrow">RELATÓRIO COMPLETO</div><h1>${esc(r.responsavelNome)} • Turno ${esc(r.turno)}</h1>${det("Data",dataBR(r.dataTurno))}${det("Horário",r.horario)}${det("Situação",r.situacao)}${det("Sistema de Fadiga",r.sistemaFadiga)}${det("Condições Operacionais",r.condicoesOperacionais)}${det("Resumo",r.resumo)}${det("Ocorrências",r.ocorrencias)}${det("Pendências recebidas",r.pendenciasRecebidas)}${det("Pendências geradas",r.pendenciasGeradas)}${det("Ações realizadas",r.acoes)}${det("Passagem de turno / Observações",r.passagemTurno)}${ci?`<div class="science big">✓ CIÊNCIA DA GESTÃO<br>${esc(ci.gestorNome)} • ${tsBR(ci.createdAt)}</div>`:""}`;
 $("#btnCiencia").style.display=ci?"none":"inline-block";$("#modal").classList.remove("hidden")
}
$("#fechar").onclick=()=>$("#modal").classList.add("hidden");$("#modal").onclick=e=>{if(e.target.id=="modal")$("#modal").classList.add("hidden")};

$("#btnCiencia").onclick=async()=>{
 if(!relAtual||!user)return;
 if(!confirm("Registrar ciência da gestão neste relatório?"))return;
 await addDoc(collection(db,"ciencia_gestao"),{relatorioId:relAtual.id,gestorUid:user.uid,gestorNome:perfil.nome||"Gestão",tipo:"RELATORIO",createdAt:serverTimestamp()});
 abrir(relAtual);
};
async function darCienciaPendencia(id){
 if(!confirm("Registrar ciência da gestão nesta pendência?"))return;
 await addDoc(collection(db,"ciencia_gestao"),{pendenciaId:id,gestorUid:user.uid,gestorNome:perfil.nome||"Gestão",tipo:"PENDENCIA",createdAt:serverTimestamp()});
}
$("#btnPrint").onclick=()=>window.print();
$("#imprimirLista").onclick=()=>window.print();

$("#exportarExcel").onclick=()=>{
 let a=relFiltrados();
 if(!a.length){alert("Nenhum relatório para exportar.");return}
 const rows=a.map(r=>({"Data":dataBR(r.dataTurno),"Turno":r.turno,"Horário":r.horario,"Colaborador":r.responsavelNome,"Situação":r.situacao,"Sistema de Fadiga":r.sistemaFadiga,"Condições Operacionais":r.condicoesOperacionais,"Resumo":r.resumo,"Ocorrências":r.ocorrencias,"Pendências Recebidas":r.pendenciasRecebidas,"Pendências Geradas":r.pendenciasGeradas,"Ações Realizadas":r.acoes,"Passagem de Turno / Observações":r.passagemTurno}));
 const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Relatórios");XLSX.writeFile(wb,`Relatorios_Fadiga_${new Date().toISOString().slice(0,10)}.xlsx`);
};