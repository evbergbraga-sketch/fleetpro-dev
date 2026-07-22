// analise.js — Aba "Análise" dentro do Financeiro
// Constrói uma visão executiva: realizado do mês, caixa projetado (8 semanas),
// payback por veículo, inadimplência com aging e evolução dos últimos 6 meses.
// Todos os números vêm de lancamentos, cobrancas_semanais, contas_pagar e veiculos
// — nenhuma tabela nova, nenhum dado inventado.

const fmtR$ = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});

let _anCarregado = false;

async function iniciarAnalise(){
  if(!_anCarregado){
    _anCarregado = true;
  }
  await Promise.all([
    _anRenderRealizado(),
    _anRenderCaixaProjetado(),
    _anRenderVeiculos(),
    _anRenderInadimplencia(),
    _anRenderEvolucao(),
  ]);
}

// ══════════════════════════════════════════════════════════════
// BLOCO 1 — REALIZADO DO MÊS (+ comparação com o mês anterior)
// ══════════════════════════════════════════════════════════════
async function _anRenderRealizado(){
  const el = document.getElementById('an-realizado');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioMesAnt = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1);
    const fimMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    const iso = d => d.toISOString().slice(0,10);

    const [rAtual, rAnt] = await Promise.all([
      sb.from('lancamentos').select('tipo,categoria,valor').gte('data', iso(inicioMes)).lte('data', iso(hoje)),
      sb.from('lancamentos').select('tipo,valor').gte('data', iso(inicioMesAnt)).lte('data', iso(fimMesAnt)),
    ]);
    if(rAtual.error) throw rAtual.error;
    if(rAnt.error) throw rAnt.error;

    const atual = rAtual.data||[], ant = rAnt.data||[];
    const soma = (arr,tipo) => arr.filter(l=>l.tipo===tipo).reduce((a,b)=>a+(parseFloat(b.valor)||0),0);
    const rec = soma(atual,'receita'), desp = soma(atual,'despesa'), liq = rec-desp;
    const recAnt = soma(ant,'receita'), despAnt = soma(ant,'despesa'), liqAnt = recAnt-despAnt;

    const variacao = (agora,antes) => antes===0 ? null : Math.round(((agora-antes)/Math.abs(antes))*100);
    const varRec = variacao(rec,recAnt), varDesp = variacao(desp,despAnt), varLiq = variacao(liq,liqAnt);
    const setaVar = (v,invertido)=>{
      if(v==null) return '<span style="color:var(--muted);font-size:11px">sem comparativo</span>';
      const bom = invertido ? v<=0 : v>=0;
      const cor = bom ? 'var(--green)' : 'var(--red)';
      const seta = v>=0 ? '▲' : '▼';
      return `<span style="color:${cor};font-size:11px;font-weight:700">${seta} ${Math.abs(v)}% vs mês anterior</span>`;
    };

    // Quebra de receita por categoria (o que realmente girou o caixa este mês)
    const porCat = {};
    atual.filter(l=>l.tipo==='receita').forEach(l=>{
      const c = l.categoria||'Outros';
      porCat[c] = (porCat[c]||0) + (parseFloat(l.valor)||0);
    });
    const catsOrdenadas = Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    const maxCat = catsOrdenadas[0]?.[1] || 1;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px">
        <div class="card" style="border-left:3px solid var(--green)">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em">Receita do mês</div>
          <div style="font-family:var(--font-display);font-size:26px;font-weight:800;margin:6px 0 4px;color:var(--green);font-variant-numeric:tabular-nums;letter-spacing:-0.01em">${fmtR$(rec)}</div>
          ${setaVar(varRec,false)}
        </div>
        <div class="card" style="border-left:3px solid var(--red)">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em">Despesa do mês</div>
          <div style="font-family:var(--font-display);font-size:26px;font-weight:800;margin:6px 0 4px;color:var(--red);font-variant-numeric:tabular-nums;letter-spacing:-0.01em">${fmtR$(desp)}</div>
          ${setaVar(varDesp,true)}
        </div>
        <div class="card" style="border-left:3px solid var(--accent)">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em">Resultado líquido</div>
          <div style="font-family:var(--font-display);font-size:26px;font-weight:800;margin:6px 0 4px;color:${liq>=0?'var(--green)':'var(--red)'};font-variant-numeric:tabular-nums;letter-spacing:-0.01em">${fmtR$(liq)}</div>
          ${setaVar(varLiq,false)}
        </div>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:12px;font-size:13px">De onde veio a receita este mês</div>
        ${catsOrdenadas.length ? catsOrdenadas.map(([cat,val])=>`
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
              <span>${cat}</span><span style="font-weight:700;font-variant-numeric:tabular-nums">${fmtR$(val)}</span>
            </div>
            <div style="background:var(--bg3);border-radius:999px;height:7px;overflow:hidden">
              <div style="background:var(--accent);height:100%;width:${Math.round(val/maxCat*100)}%;border-radius:999px"></div>
            </div>
          </div>`).join('') : '<div style="color:var(--muted);font-size:13px">Nenhuma receita lançada este mês.</div>'}
      </div>`;
  }catch(e){
    el.innerHTML = `<div class="card" style="color:var(--red);font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// BLOCO 2 — CAIXA PROJETADO (8 SEMANAS)
// Entradas: cobranças semanais pendentes/atrasadas de locações ATIVAS
//           (dinheiro já contratado, não é estimativa).
// Saídas: contas a pagar pendentes com vencimento agendado.
// ══════════════════════════════════════════════════════════════
async function _anRenderCaixaProjetado(){
  const el = document.getElementById('an-caixa');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const fim8sem = new Date(hoje.getTime() + 8*7*86400000);
    const iso = d => d.toISOString().slice(0,10);

    const [rCobr, rContas] = await Promise.all([
      sb.from('cobrancas_semanais').select('valor,data_vencimento,status,locacoes!inner(status)')
        .in('status',['pendente','atrasado']).eq('locacoes.status','ativa')
        .lte('data_vencimento', iso(fim8sem)),
      sb.from('contas_pagar').select('valor,vencimento,status')
        .eq('status','pendente').lte('vencimento', iso(fim8sem)),
    ]);
    if(rCobr.error) throw rCobr.error;
    if(rContas.error) throw rContas.error;

    // Agrupa em 8 baldes semanais a partir de hoje
    const semanas = Array.from({length:8}, (_,i)=>{
      const ini = new Date(hoje.getTime() + i*7*86400000);
      const fim = new Date(ini.getTime() + 6*86400000);
      return { ini, fim, entradas:0, saidas:0 };
    });
    const bucket = data => {
      const d = new Date(data+'T12:00:00');
      const dias = Math.floor((d - hoje)/86400000);
      const idx = Math.floor(dias/7);
      return (idx>=0 && idx<8) ? idx : null;
    };
    (rCobr.data||[]).forEach(c=>{
      const idx = bucket(c.data_vencimento);
      if(idx!=null) semanas[idx].entradas += parseFloat(c.valor)||0;
    });
    (rContas.data||[]).forEach(c=>{
      const idx = bucket(c.vencimento);
      if(idx!=null) semanas[idx].saidas += parseFloat(c.valor)||0;
    });

    let acumulado = 0;
    const pontos = [];
    const totalEntradas = semanas.reduce((a,b)=>a+b.entradas,0);
    const totalSaidas   = semanas.reduce((a,b)=>a+b.saidas,0);
    const fmtDia = d => d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});

    semanas.forEach(s=>{ acumulado += s.entradas - s.saidas; pontos.push(acumulado); });
    const piorIdx = pontos.indexOf(Math.min(...pontos));
    const semanaPior = semanas[piorIdx];
    const maiorSaidaIdx = semanas.reduce((best,s,i)=> s.saidas>semanas[best].saidas ? i : best, 0);
    const semanaMaiorSaida = semanas[maiorSaidaIdx];

    const labels = semanas.map(s=>`${fmtDia(s.ini)}`);
    const canvasId = 'an-caixa-chart-'+Date.now();

    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em">Caixa projetado · 8 semanas</div>
            <div style="font-family:var(--font-display);font-size:28px;font-weight:800;margin:6px 0 0;color:${acumulado>=0?'var(--green)':'var(--red)'};font-variant-numeric:tabular-nums;letter-spacing:-0.01em">${fmtR$(acumulado)}</div>
          </div>
          ${semanaPior ? `<div style="text-align:right">
            <div style="font-size:11px;color:var(--muted)">Pior ponto do período</div>
            <div style="font-size:13px;font-weight:700;color:var(--red);margin-top:4px">${fmtR$(pontos[piorIdx])} <span style="font-weight:500;color:var(--muted);font-size:11.5px">em ${fmtDia(semanaPior.ini)}–${fmtDia(semanaPior.fim)}</span></div>
          </div>` : ''}
        </div>

        <div style="position:relative;height:180px;margin:14px 0 4px">
          <canvas id="${canvasId}" role="img" aria-label="Trajetória do saldo de caixa acumulado ao longo das próximas 8 semanas">Saldo de caixa projetado semana a semana.</canvas>
        </div>

        <div style="display:flex;gap:20px;flex-wrap:wrap;padding-top:14px;margin-top:8px;border-top:1px solid var(--border2)">
          <div>
            <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Entradas contratadas</div>
            <div style="font-size:16px;font-weight:700;color:var(--green);margin-top:3px;font-variant-numeric:tabular-nums">+${fmtR$(totalEntradas)}</div>
          </div>
          <div>
            <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Saídas agendadas</div>
            <div style="font-size:16px;font-weight:700;color:var(--red);margin-top:3px;font-variant-numeric:tabular-nums">-${fmtR$(totalSaidas)}</div>
          </div>
          ${semanaMaiorSaida?.saidas>0 ? `<div style="margin-left:auto;text-align:right">
            <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Maior saída isolada</div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-top:3px">${fmtR$(semanaMaiorSaida.saidas)} · ${fmtDia(semanaMaiorSaida.ini)}–${fmtDia(semanaMaiorSaida.fim)}</div>
          </div>` : ''}
        </div>
      </div>`;

    // Gráfico de trajetória: linha do acumulado, com preenchimento em
    // gradiente (verde quando positivo, vermelho quando cai abaixo de zero)
    requestAnimationFrame(()=>{
      const canvas = document.getElementById(canvasId);
      if(!canvas || typeof Chart==='undefined') return;
      const ctx = canvas.getContext('2d');
      const corLinha = acumulado>=0 ? '#15803d' : '#DC2626';
      const gradiente = ctx.createLinearGradient(0,0,0,180);
      gradiente.addColorStop(0, acumulado>=0 ? 'rgba(21,128,61,0.22)' : 'rgba(220,38,38,0.22)');
      gradiente.addColorStop(1, acumulado>=0 ? 'rgba(21,128,61,0)' : 'rgba(220,38,38,0)');
      new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [{
          data: pontos, borderColor: corLinha, borderWidth: 2.5, pointRadius: 0,
          pointHoverRadius: 5, pointHoverBackgroundColor: corLinha, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
          fill: true, backgroundColor: gradiente, tension: 0.35,
        }]},
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: {display:false}, tooltip: {
            backgroundColor: '#18181B', titleColor: '#A1A1AA', bodyColor: '#FAFAFA', padding: 10, displayColors: false,
            callbacks: { label: c => fmtR$(c.parsed.y) }
          }},
          scales: {
            y: { grid:{color:'#EBEBEB'}, ticks:{ color:'#A1A1AA', font:{size:10}, callback: v => (v/1000).toFixed(0)+'k' }, border:{display:false} },
            x: { grid:{display:false}, ticks:{ color:'#A1A1AA', font:{size:10.5} }, border:{display:false} },
          }
        }
      });
    });
  }catch(e){
    el.innerHTML = `<div class="card" style="color:var(--red);font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// BLOCO 3 — DESEMPENHO POR VEÍCULO
// Payback: receita total (lancamentos) ÷ valor de compra, desde sempre.
// Ocupação: % de dias em locação nos últimos 90 dias (janela fixa —
// comparável entre veículos de idades diferentes).
// Receita/dia: receita total ÷ dias corridos desde a compra.
// ══════════════════════════════════════════════════════════════
let _anVeiculosDados = [];
let _anVeiculosExpandido = false;

async function _anRenderVeiculos(){
  const el = document.getElementById('an-veiculos');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const janela90 = new Date(hoje.getTime() - 90*86400000);

    const [rVeic, rRec, rLoc] = await Promise.all([
      sb.from('veiculos').select('id,marca,modelo,placa,tipo,status,foto_url,valor_compra,data_compra').neq('status','vendido'),
      sb.from('lancamentos').select('veiculo_id,valor').eq('tipo','receita').not('veiculo_id','is',null),
      sb.from('locacoes').select('veiculo_id,data_inicio,data_fim,status'),
    ]);
    if(rVeic.error) throw rVeic.error;
    if(rRec.error) throw rRec.error;
    if(rLoc.error) throw rLoc.error;

    const veiculos = rVeic.data||[], receitas = rRec.data||[], locacoes = rLoc.data||[];

    _anVeiculosDados = veiculos.map(v=>{
      const receitaTotal = receitas.filter(r=>r.veiculo_id===v.id).reduce((a,r)=>a+(parseFloat(r.valor)||0),0);
      let custo = parseFloat(v.valor_compra)||0;
      // Valores abaixo de R$1.000 para um veículo são quase certamente erro
      // de cadastro (ex: faltou dígito) — tratamos como "não informado" em
      // vez de calcular um payback absurdo (ex: 5000%)
      const custoSuspeito = custo>0 && custo<1000;
      if(custoSuspeito) custo = 0;
      const pctRecuperado = custo>0 ? Math.round(receitaTotal/custo*100) : null;

      // Ocupação nos últimos 90 dias: soma a sobreposição de cada locação
      // desse veículo com a janela [janela90, hoje]
      const locsVeic = locacoes.filter(l=>l.veiculo_id===v.id);
      let diasOcupado = 0;
      locsVeic.forEach(l=>{
        if(!l.data_inicio) return;
        const ini = new Date(Math.max(new Date(l.data_inicio), janela90));
        const fim = new Date(Math.min(l.data_fim?new Date(l.data_fim):hoje, hoje));
        if(fim>ini) diasOcupado += Math.round((fim-ini)/86400000);
      });
      const pctOcupacao = Math.min(100, Math.round(diasOcupado/90*100));

      const diasDesdeCompra = v.data_compra ? Math.max(1, Math.round((hoje-new Date(v.data_compra))/86400000)) : null;
      const receitaDia = diasDesdeCompra ? receitaTotal/diasDesdeCompra : null;

      return { v, receitaTotal, custo, custoSuspeito, pctRecuperado, pctOcupacao, receitaDia };
    }).sort((a,b)=>{
      // Sem valor de compra cadastrado vai pro fim; senão, pior payback primeiro
      if(a.pctRecuperado==null && b.pctRecuperado==null) return 0;
      if(a.pctRecuperado==null) return 1;
      if(b.pctRecuperado==null) return -1;
      return a.pctRecuperado - b.pctRecuperado;
    });

    _anVeiculosExpandido = false;

    // Shell fixo: renderizado UMA vez. O campo de busca e a lista ficam
    // dentro de um container próprio (#an-veic-lista) que é o único
    // atualizado a cada tecla digitada — assim o input nunca perde o foco
    // (re-renderizar o input inteiro a cada tecla fazia só dar pra digitar
    // uma letra por vez).
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:700;font-size:13px">Desempenho por veículo</div>
          <input type="text" id="an-veic-busca" placeholder="Buscar por modelo ou placa..." oninput="_anRenderVeiculosLista()" style="font-size:12px;padding:5px 10px;max-width:220px">
        </div>
        <div id="an-veic-sub" style="font-size:11px;color:var(--muted);margin-bottom:10px"></div>
        <div id="an-veic-lista"></div>
      </div>`;

    _anRenderVeiculosLista();
  }catch(e){
    el.innerHTML = `<div class="card" style="color:#F87171;font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

function _anToggleVeiculosExpandido(){
  _anVeiculosExpandido = !_anVeiculosExpandido;
  _anRenderVeiculosLista();
}

function _anRenderVeiculosLista(){
  const listaEl = document.getElementById('an-veic-lista');
  const subEl   = document.getElementById('an-veic-sub');
  if(!listaEl) return;
  const busca = (document.getElementById('an-veic-busca')?.value||'').toLowerCase().trim();

  const linha = (label,val,cor) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:var(--muted)">${label}</span><span style="font-weight:700;${cor?`color:${cor}`:''}">${val}</span></div>`;

  const filtrados = _anVeiculosDados.filter(d=>{
    if(!busca) return true;
    const alvo = `${d.v.marca} ${d.v.modelo} ${d.v.placa}`.toLowerCase();
    return alvo.includes(busca);
  });
  const limite = _anVeiculosExpandido ? filtrados.length : 7;
  const visiveis = filtrados.slice(0, limite);
  const restante = filtrados.length - limite;

  if(subEl) subEl.textContent = `Payback (receita histórica ÷ custo de compra) · Ocupação nos últimos 90 dias · ${filtrados.length} veículo${filtrados.length===1?'':'s'}`;

  if(!filtrados.length){
    listaEl.innerHTML = '<div style="font-size:13px;color:var(--muted)">Nenhum veículo encontrado.</div>';
    return;
  }

  const cardsHtml = visiveis.map(d=>{
    const vTipo = d.v.tipo||'carro';
    const thumb = d.v.foto_url
      ? `<div class="vi vi-foto" style="margin-bottom:6px"><img src="${d.v.foto_url}" onerror="this.parentElement.className='vi ${vTipo==='carro'?'vi-car':'vi-moto'}';this.parentElement.innerHTML=SVG_VEICULO('${vTipo}')"></div>`
      : `<div class="vi ${vTipo==='carro'?'vi-car':'vi-moto'}" style="margin-bottom:6px">${SVG_VEICULO(vTipo)}</div>`;
    return `
            <div style="border:1px solid var(--border2);border-radius:10px;padding:10px 12px">
              ${thumb}
              <div style="font-weight:700;font-size:13px">${d.v.marca} ${d.v.modelo}</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${d.v.placa}</div>
              ${d.custo>0 ? `
                ${linha('Custo de compra', fmtR$(d.custo))}
                ${linha('Recebido (histórico)', fmtR$(d.receitaTotal), '#16a34a')}
                <div style="background:var(--border2);border-radius:999px;height:5px;overflow:hidden;margin:5px 0">
                  <div style="background:${d.pctRecuperado>=100?'#16a34a':'var(--accent)'};height:100%;width:${Math.min(100,d.pctRecuperado)}%"></div>
                </div>
                ${linha('Payback', d.pctRecuperado+'%', d.pctRecuperado>=100?'#16a34a':null)}
              ` : `<div style="font-size:11px;color:${d.custoSuspeito?'#F5B942':'var(--muted)'};font-style:italic;margin-bottom:6px">${d.custoSuspeito?'Valor de compra parece incorreto (R$ '+d.v.valor_compra+') — confira o cadastro':'Sem valor de compra cadastrado'}</div>`}
              ${linha('Ocupação (90d)', d.pctOcupacao+'%', d.pctOcupacao>=70?'#16a34a':d.pctOcupacao<30?'#F87171':null)}
              ${d.receitaDia!=null?linha('Receita/dia (média)', fmtR$(d.receitaDia)):''}
            </div>`;
  }).join('');

  listaEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">
          ${cardsHtml}
        </div>
        ${filtrados.length>7 ? `
        <div style="text-align:center;padding-top:12px">
          <button class="btn btn-ghost" onclick="_anToggleVeiculosExpandido()" style="font-size:12px;padding:5px 16px">
            ${_anVeiculosExpandido ? 'Exibir menos' : `Exibir mais (${restante})`}
          </button>
        </div>` : ''}`;
}

// ══════════════════════════════════════════════════════════════
// BLOCO 4 — INADIMPLÊNCIA COM AGING
// Cobranças semanais vencidas (pendente/atrasado + data_vencimento no
// passado), agrupadas por faixa de atraso — prioriza quem cobrar primeiro.
// ══════════════════════════════════════════════════════════════
async function _anRenderInadimplencia(){
  const el = document.getElementById('an-inadimplencia');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const {data, error} = await sb.from('cobrancas_semanais')
      .select('valor,data_vencimento,status,locacoes(clientes(nome))')
      .in('status',['pendente','atrasado'])
      .lt('data_vencimento', hoje.toISOString().slice(0,10));
    if(error) throw error;

    const vencidas = (data||[]).map(c=>({
      ...c,
      diasAtraso: Math.floor((hoje - new Date(c.data_vencimento+'T12:00:00'))/86400000)
    }));

    const faixas = [
      {label:'1–7 dias',   min:1,  max:7},
      {label:'8–14 dias',  min:8,  max:14},
      {label:'15–30 dias', min:15, max:30},
      {label:'30+ dias',   min:31, max:Infinity},
    ];
    const buckets = faixas.map(f=>{
      const itens = vencidas.filter(c=>c.diasAtraso>=f.min && c.diasAtraso<=f.max);
      return { ...f, count:itens.length, valor:itens.reduce((a,c)=>a+(parseFloat(c.valor)||0),0) };
    });
    const totalValor = vencidas.reduce((a,c)=>a+(parseFloat(c.valor)||0),0);
    const maxValor = Math.max(...buckets.map(b=>b.valor), 1);
    const cores = ['#D97706','#EA580C','#DC2626','#991B1B'];

    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px">
          <div style="font-weight:700;font-size:13px">Inadimplência por tempo de atraso</div>
          <div style="text-align:right">
            <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Total vencido</div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--red);margin-top:2px;font-variant-numeric:tabular-nums">${fmtR$(totalValor)}</div>
          </div>
        </div>
        ${vencidas.length===0 ? '<div style="font-size:13px;color:var(--green)">Nenhuma cobrança vencida no momento.</div>' :
          buckets.map((b,i)=>`
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">
                <span>${b.label} <span style="color:var(--muted);font-size:12px">(${b.count})</span></span>
                <span style="font-weight:700;font-variant-numeric:tabular-nums">${fmtR$(b.valor)}</span>
              </div>
              <div style="background:var(--bg3);border-radius:999px;height:9px;overflow:hidden">
                <div style="background:${cores[i]};height:100%;width:${Math.round(b.valor/maxValor*100)}%;min-width:${b.valor>0?'3px':'0'};border-radius:999px"></div>
              </div>
            </div>`).join('')}
      </div>`;
  }catch(e){
    el.innerHTML = `<div class="card" style="color:var(--red);font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// BLOCO 5 — EVOLUÇÃO (últimos 6 meses)
// Receita x despesa mês a mês, para enxergar tendência/sazonalidade.
// ══════════════════════════════════════════════════════════════
async function _anRenderEvolucao(){
  const el = document.getElementById('an-evolucao');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const inicio6m = new Date(hoje.getFullYear(), hoje.getMonth()-5, 1);
    const {data, error} = await sb.from('lancamentos').select('tipo,valor,data')
      .gte('data', inicio6m.toISOString().slice(0,10));
    if(error) throw error;
    const lanc = data||[];

    const meses = Array.from({length:6}, (_,i)=>{
      const d = new Date(hoje.getFullYear(), hoje.getMonth()-5+i, 1);
      return { label: d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}), ym: d.toISOString().slice(0,7), receita:0, despesa:0 };
    });
    lanc.forEach(l=>{
      const ym = (l.data||'').slice(0,7);
      const m = meses.find(x=>x.ym===ym);
      if(!m) return;
      if(l.tipo==='receita') m.receita += parseFloat(l.valor)||0;
      else if(l.tipo==='despesa') m.despesa += parseFloat(l.valor)||0;
    });
    const maxVal = Math.max(...meses.map(m=>Math.max(m.receita,m.despesa)), 1);

    const canvasId = 'an-evol-chart-'+Date.now();

    el.innerHTML = `
      <div class="card">
        <div style="font-weight:700;margin-bottom:4px;font-size:13px">Evolução — últimos 6 meses</div>
        <div style="display:flex;gap:16px;margin-bottom:12px">
          <span style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:9px;height:9px;background:var(--green);border-radius:2px"></span>Receita</span>
          <span style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:9px;height:9px;background:var(--red);border-radius:2px"></span>Despesa</span>
        </div>
        <div style="position:relative;height:200px">
          <canvas id="${canvasId}" role="img" aria-label="Gráfico de barras comparando receita e despesa mensal nos últimos 6 meses">Receita e despesa mês a mês.</canvas>
        </div>
      </div>`;

    requestAnimationFrame(()=>{
      const canvas = document.getElementById(canvasId);
      if(!canvas || typeof Chart==='undefined') return;
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: meses.map(m=>m.label),
          datasets: [
            { label:'Receita', data: meses.map(m=>m.receita), backgroundColor:'#15803d', borderRadius:4, maxBarThickness:22 },
            { label:'Despesa', data: meses.map(m=>m.despesa), backgroundColor:'#DC2626', borderRadius:4, maxBarThickness:22 },
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false}, tooltip:{
            backgroundColor:'#18181B', titleColor:'#A1A1AA', bodyColor:'#FAFAFA', padding:10, displayColors:false,
            callbacks:{ label: c => c.dataset.label+': '+fmtR$(c.parsed.y) }
          }},
          scales:{
            y:{ grid:{color:'#EBEBEB'}, ticks:{ color:'#A1A1AA', font:{size:10}, callback:v=>(v/1000).toFixed(0)+'k' }, border:{display:false} },
            x:{ grid:{display:false}, ticks:{ color:'#A1A1AA', font:{size:11} }, border:{display:false} },
          }
        }
      });
    });
  }catch(e){
    el.innerHTML = `<div class="card" style="color:var(--red);font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}
