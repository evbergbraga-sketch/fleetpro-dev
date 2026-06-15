// ══ RASTREADOR TOGGLE ══
function _toggleRastreador(prefix){
  const sel = document.getElementById(prefix+'-tem-rastreador');
  const wrap = document.getElementById(prefix+'-rastreador-empresa-wrap');
  if(wrap) wrap.style.display = sel?.value==='sim' ? '' : 'none';
}

// ══ ANEXOS / UPLOAD ══
let _veicAnexosNovos = {}; // { prefix: [File, ...] }
if(!window._veicAnexosRemovidos) window._veicAnexosRemovidos = {};

function _previewAnexos(prefix, files){
  if(!_veicAnexosNovos[prefix]) _veicAnexosNovos[prefix] = [];
  Array.from(files).forEach(f=>{
    if(f.size > 10*1024*1024){ notify(f.name+': arquivo muito grande (máx 10MB)','error'); return; }
    _veicAnexosNovos[prefix].push(f);
  });
  _renderAnexosLista(prefix);
  const inp = document.getElementById(prefix+'-anexos-input');
  if(inp) inp.value='';
}

function _renderAnexosLista(prefix){
  const lista = document.getElementById(prefix+'-anexos-lista');
  if(!lista) return;
  const novos = _veicAnexosNovos[prefix]||[];
  const existing = lista.querySelectorAll('.anexo-existente');
  const existHtml = Array.from(existing).map(el=>el.outerHTML).join('');
  if(!novos.length){ lista.innerHTML=existHtml; return; }
  const novosHtml = novos.map((f,i)=>`
    <div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <span style="font-size:18px">${_fileIcon(f.name)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
        <div style="font-size:10px;color:var(--muted)">${(f.size/1024).toFixed(1)} KB — aguardando envio</div>
      </div>
      <button onclick="_removeAnexoNovo('${prefix}',${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
    </div>`).join('');
  lista.innerHTML = existHtml + novosHtml;
}

function _renderAnexosExistentes(prefix, urls){
  const lista = document.getElementById(prefix+'-anexos-lista');
  if(!lista) return;
  let arr = [];
  try{ arr = urls ? (Array.isArray(urls) ? urls : JSON.parse(urls)) : []; }catch(_){}
  const existHtml = arr.map((u,i)=>{
    // Remove prefixo timestamp_hash_ do nome do arquivo
    const rawName = decodeURIComponent(u.split('/').pop().split('?')[0]);
    const matchName = rawName.match(/^\d{13}_[a-z0-9]+_(.+)$/i);
    const name = matchName ? matchName[1] : rawName;
    return `<div class="anexo-existente" data-idx="${i}" style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <span style="font-size:18px">${_fileIcon(name)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
        <div style="font-size:10px;color:var(--muted)">Arquivo salvo</div>
      </div>
      <button onclick="_abrirAnexo('${u}')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px" title="Abrir arquivo">🔗</button>
      <button onclick="_removeAnexoExistente('${prefix}','${u}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px">✕</button>
    </div>`;
  }).join('');
  lista.innerHTML = existHtml;
  _renderAnexosLista(prefix);
}

function _removeAnexoNovo(prefix, i){
  if(_veicAnexosNovos[prefix]) _veicAnexosNovos[prefix].splice(i,1);
  _renderAnexosLista(prefix);
}

function _removeAnexoExistente(prefix, url){
  if(!window._veicAnexosRemovidos[prefix]) window._veicAnexosRemovidos[prefix] = [];
  window._veicAnexosRemovidos[prefix].push(url);
  const lista = document.getElementById(prefix+'-anexos-lista');
  if(!lista) return;
  lista.querySelectorAll('.anexo-existente').forEach(el=>{
    if(el.querySelector('button[onclick*="'+url.slice(-20)+'"]')) el.remove();
  });
  // re-render to clean up
  const btn = lista.querySelector('button[onclick*="removeAnexoExistente"]');
  // fallback: just remove the item with matching url in onclick
  Array.from(lista.querySelectorAll('.anexo-existente')).forEach(el=>{
    if(el.innerHTML.includes(url.slice(-30))) el.remove();
  });
}

function _fileIcon(name){
  const ext = (name||'').split('.').pop().toLowerCase();
  if(['pdf'].includes(ext)) return '📄';
  if(['jpg','jpeg','png','webp','gif'].includes(ext)) return '🖼️';
  if(['doc','docx'].includes(ext)) return '📝';
  return '📎';
}

async function _abrirAnexo(url){
  try{
    const signed = await _getSignedUrl(url);
    window.open(signed, '_blank');
  }catch(e){
    notify('Erro ao abrir arquivo','error');
  }
}

async function _uploadAnexos(prefix, veiculoId){
  const files = _veicAnexosNovos[prefix]||[];
  if(!files.length) return [];
  const uploaded = [];
  for(const f of files){
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = `veiculos/${veiculoId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
    const {error} = await sb.storage.from('veiculos-docs').upload(path, f, {upsert:false});
    if(error){ notify('Erro ao enviar '+f.name+': '+error.message,'error'); continue; }
    const { data: pub } = sb.storage.from('veiculos-docs').getPublicUrl(path);
    uploaded.push(pub.publicUrl);
  }
  return uploaded;
}

function _coletarAnexosExistentes(prefix){
  const lista = document.getElementById(prefix+'-anexos-lista');
  if(!lista) return [];
  const urls = [];
  lista.querySelectorAll('.anexo-existente').forEach(el=>{
    const a = el.querySelector('a');
    if(a) urls.push(a.href);
  });
  return urls;
}

// ══ IPVA E MANUTENÇÕES DINÂMICOS ══
// _veicIpvas agora é usado apenas como buffer de edição no formulário.
// Ao salvar, cada entrada vai para doc_veiculos. Ao carregar, lê de doc_veiculos
// com fallback para o JSON legado (campo ipvas) enquanto a migração não cobriu tudo.
let _veicIpvas = [];       // [{id?, ano, valor, vencimento, _novo?}]
let _veicManutencoes = []; // [{data, tipo, obs}]
let _veicIdEmEdicao = null; // id do veículo sendo editado (para salvar docs)

// Cache de doc_tipos para não bater no banco a cada render
let _docTipos = null;
async function _getDocTipos(){
  if(_docTipos) return _docTipos;
  const {data} = await sb.from('doc_tipos').select('*').order('nome');
  _docTipos = data||[];
  return _docTipos;
}

// Busca o tipo "IPVA" pelo nome
async function _getTipoIdByNome(nome){
  const tipos = await _getDocTipos();
  return tipos.find(t=>t.nome===nome)?.id||null;
}

// Carrega IPVAs de um veículo a partir de doc_veiculos
async function _carregarIpvasDoVeiculo(veiculoId){
  if(!veiculoId) return [];
  const tipoId = await _getTipoIdByNome('IPVA');
  if(!tipoId) return [];
  const {data} = await sb.from('doc_veiculos')
    .select('*')
    .eq('veiculo_id', veiculoId)
    .eq('tipo_id', tipoId)
    .order('ano_exercicio', {ascending:false});
  return (data||[]).map(d=>({
    id: d.id,
    ano: String(d.ano_exercicio||new Date().getFullYear()),
    valor: d.valor||'',
    vencimento: d.data_vencimento||'',
    status: d.status||'em_dia',
  }));
}

// Salva/atualiza IPVAs em doc_veiculos após salvar o veículo
async function _salvarIpvasNoBanco(veiculoId){
  if(!veiculoId || !_veicIpvas.length) return;
  const tipoId = await _getTipoIdByNome('IPVA');
  if(!tipoId) return;

  for(const ip of _veicIpvas){
    if(!ip.vencimento) continue; // vencimento é obrigatório
    const hoje = new Date();
    const venc = new Date(ip.vencimento);
    const tipos = await _getDocTipos();
    const tipo = tipos.find(t=>t.id===tipoId);
    const diasAlerta = tipo?.dias_alerta||30;
    const diffDias = Math.ceil((venc - hoje)/86400000);
    const status = diffDias < 0 ? 'vencido' : diffDias <= diasAlerta ? 'alerta' : 'em_dia';

    if(ip.id){
      // Atualiza registro existente
      await sb.from('doc_veiculos').update({
        ano_exercicio:  parseInt(ip.ano)||null,
        data_vencimento: ip.vencimento,
        valor:          parseFloat(ip.valor)||null,
        status,
        updated_at:     new Date().toISOString(),
      }).eq('id', ip.id);
    } else {
      // Novo registro
      await sb.from('doc_veiculos').insert({
        veiculo_id:     veiculoId,
        tipo_id:        tipoId,
        ano_exercicio:  parseInt(ip.ano)||null,
        data_vencimento: ip.vencimento,
        valor:          parseFloat(ip.valor)||null,
        status,
        criado_por:     currentUser?.id||null,
      });
    }
  }
}

// Salva seguro em doc_veiculos
async function _salvarSeguroNoBanco(veiculoId, seguradora, apolice, vencimento, valor, periodicidade){
  // Cria lançamento financeiro automático se tiver valor
  if(valor && valor > 0 && typeof finRegistrarLancamentoSeguro === 'function'){
    finRegistrarLancamentoSeguro(veiculoId, seguradora, valor, periodicidade, vencimento);
  }
}
async function _salvarSeguroNoBancoLegado(veiculoId, seguradora, apolice, vencimento){
  if(!veiculoId || !vencimento) return;
  const tipoId = await _getTipoIdByNome('Seguro frota');
  if(!tipoId) return;

  const hoje = new Date();
  const venc = new Date(vencimento);
  const tipos = await _getDocTipos();
  const tipo = tipos.find(t=>t.id===tipoId);
  const diasAlerta = tipo?.dias_alerta||45;
  const diffDias = Math.ceil((venc - hoje)/86400000);
  const status = diffDias < 0 ? 'vencido' : diffDias <= diasAlerta ? 'alerta' : 'em_dia';
  const obs = [seguradora, apolice].filter(Boolean).join(' | ')||null;

  // Verifica se já existe um registro de seguro para este veículo (upsert pelo mais recente)
  const {data: existing} = await sb.from('doc_veiculos')
    .select('id')
    .eq('veiculo_id', veiculoId)
    .eq('tipo_id', tipoId)
    .order('created_at', {ascending:false})
    .limit(1);

  if(existing && existing.length){
    await sb.from('doc_veiculos').update({
      data_vencimento: vencimento,
      observacoes: obs,
      status,
      updated_at: new Date().toISOString(),
    }).eq('id', existing[0].id);
  } else {
    await sb.from('doc_veiculos').insert({
      veiculo_id:     veiculoId,
      tipo_id:        tipoId,
      data_vencimento: vencimento,
      observacoes:    obs,
      status,
      criado_por:     currentUser?.id||null,
    });
  }
}

function _addIpva(prefix){
  const ano = new Date().getFullYear();
  _veicIpvas.push({ano: String(ano), valor:'', vencimento:''});
  _renderIpvas(prefix);
}

function _removeIpva(i, prefix){
  _veicIpvas.splice(i,1);
  _renderIpvas(prefix);
}

function _renderIpvas(prefix){
  const wrap = document.getElementById(prefix+'-ipvas');
  if(!wrap) return;
  if(!_veicIpvas.length){
    wrap.innerHTML='<div style="font-size:12px;color:var(--muted2);padding:6px 0">Nenhum IPVA cadastrado. Clique em "+ Ano" para adicionar.</div>';
    return;
  }
  wrap.innerHTML = _veicIpvas.map((ip,i)=>{
    const badgeColor = ip.status==='vencido' ? '#dc2626' : ip.status==='alerta' ? '#d97706' : '#16a34a';
    const badgeTxt  = ip.status==='vencido' ? '⚠️ Vencido' : ip.status==='alerta' ? '⚡ Atenção' : '';
    return `
    <div style="display:grid;grid-template-columns:80px 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;background:var(--bg2);padding:10px;border-radius:8px;border:1px solid ${ip.status==='vencido'?'rgba(220,38,38,.3)':ip.status==='alerta'?'rgba(217,119,6,.3)':'var(--border2)'}">
      <div class="form-group" style="margin:0">
        <label style="font-size:10px">Ano</label>
        <input type="number" value="${ip.ano}" min="2020" max="2035" style="width:100%" onchange="_veicIpvas[${i}].ano=this.value">
      </div>
      <div class="form-group" style="margin:0">
        <label style="font-size:10px">Valor (R$)</label>
        <input type="number" value="${ip.valor}" step="0.01" style="width:100%" onchange="_veicIpvas[${i}].valor=this.value">
      </div>
      <div class="form-group" style="margin:0">
        <label style="font-size:10px">Vencimento ${badgeTxt?`<span style="color:${badgeColor};font-size:9px">${badgeTxt}</span>`:''}</label>
        <input type="date" value="${ip.vencimento}" style="width:100%" onchange="_veicIpvas[${i}].vencimento=this.value">
      </div>
      <button onclick="_removeIpva(${i},'${prefix}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:4px;align-self:center">✕</button>
    </div>`;
  }).join('');
}

function _addManutencao(prefix){
  _veicManutencoes.push({data: new Date().toISOString().slice(0,10), tipo:'Revisão', obs:''});
  _renderManutencoes(prefix);
}

function _removeManutencao(i, prefix){
  _veicManutencoes.splice(i,1);
  _renderManutencoes(prefix);
}

function _renderManutencoes(prefix){
  const wrap = document.getElementById(prefix+'-manutencoes');
  if(!wrap) return;
  if(!_veicManutencoes.length){
    wrap.innerHTML='<div style="font-size:12px;color:var(--muted2);padding:6px 0">Nenhuma manutenção registrada. Clique em "+ Adicionar".</div>';
    return;
  }
  wrap.innerHTML = _veicManutencoes.map((m,i)=>`
    <div style="background:var(--bg2);padding:10px;border-radius:8px;border:1px solid var(--border2);margin-bottom:8px">
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-bottom:6px">
        <div class="form-group" style="margin:0">
          <label style="font-size:10px">Data</label>
          <input type="date" value="${m.data}" style="width:100%" onchange="_veicManutencoes[${i}].data=this.value">
        </div>
        <div class="form-group" style="margin:0">
          <label style="font-size:10px">Tipo</label>
          <select style="width:100%" onchange="_veicManutencoes[${i}].tipo=this.value">
            <option ${m.tipo==='Revisão'?'selected':''}>Revisão</option>
            <option ${m.tipo==='Troca de óleo'?'selected':''}>Troca de óleo</option>
            <option ${m.tipo==='Pneu'?'selected':''}>Pneu</option>
            <option ${m.tipo==='Freios'?'selected':''}>Freios</option>
            <option ${m.tipo==='Corrente'?'selected':''}>Corrente</option>
            <option ${m.tipo==='Elétrica'?'selected':''}>Elétrica</option>
            <option ${m.tipo==='Funilaria'?'selected':''}>Funilaria</option>
            <option ${m.tipo==='Outro'?'selected':''}>Outro</option>
          </select>
        </div>
        <button onclick="_removeManutencao(${i},'${prefix}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:4px">✕</button>
      </div>
      <div class="form-group" style="margin:0">
        <label style="font-size:10px">Observação</label>
        <textarea rows="2" style="width:100%;resize:vertical;font-size:12px" placeholder="Descreva o que foi feito..." onchange="_veicManutencoes[${i}].obs=this.value">${m.obs}</textarea>
      </div>
    </div>`).join('');
}

function _coletarCamposExtras(prefix){
  const g = id => document.getElementById(prefix+'-'+id)?.value||null;
  const temRast = g('tem-rastreador')||'nao';
  return {
    chassi:              g('chassi')||null,
    renavam:             g('renavam')||null,
    estado:              g('estado')||null,
    proprietario_nome:   g('proprietario-nome')||null,
    cpf_cnpj_proprietario: g('cpf-cnpj-prop')||null,
    data_compra:         g('data-compra')||null,
    valor_compra:        parseFloat(g('valor-compra'))||null,
    nf_compra:           g('nf-compra')||null,
    fornecedor:          g('fornecedor')||null,
    hodometro_entrada:   parseInt(g('hodometro-entrada'))||null,
    local_entrega:       g('local-entrega')||null,
    data_entrada:        g('data-entrada')||null,
    data_entrega:        g('data-entrega')||null,
    produtos:            g('produtos')||null,
    ipvas:               _veicIpvas.length>0 ? JSON.stringify(_veicIpvas) : null,
    manutencoes_veiculo: _veicManutencoes.length>0 ? JSON.stringify(_veicManutencoes) : null,
    // Seguro
    seguradora:          g('seguradora')||null,
    apolice:             g('apolice')||null,
    seguro_vencimento:   g('seguro-vencimento')||null,
    seguro_valor:        parseFloat(g('seguro-valor'))||null,
    seguro_periodicidade: g('seguro-periodicidade')||'anual',
    seguro_valor:        parseFloat(g('seguro-valor'))||null,
    seguro_periodicidade: g('seguro-periodicidade')||'anual',
    // Rastreador
    tem_rastreador:      temRast === 'sim',
    rastreador_empresa:  temRast === 'sim' ? (g('rastreador-empresa')||null) : null,
  };
}

function _preencherCamposExtras(prefix, v){
  const s = (id,val)=>{ const e=document.getElementById(prefix+'-'+id); if(e) e.value=val||''; };
  s('chassi', v.chassi);
  s('renavam', v.renavam);
  s('estado', v.estado);
  s('proprietario-nome', v.proprietario_nome);
  s('cpf-cnpj-prop', v.cpf_cnpj_proprietario);
  s('data-compra', v.data_compra);
  s('valor-compra', v.valor_compra);
  s('nf-compra', v.nf_compra);
  s('fornecedor', v.fornecedor);
  s('hodometro-entrada', v.hodometro_entrada);
  s('local-entrega', v.local_entrega);
  s('data-entrada', v.data_entrada);
  s('data-entrega', v.data_entrega);
  s('produtos', v.produtos);
  // Seguro
  s('seguradora', v.seguradora);
  s('apolice', v.apolice);
  s('seguro-vencimento', v.seguro_vencimento);
  s('seguro-valor', v.seguro_valor||'');
  s('seguro-periodicidade', v.seguro_periodicidade||'anual');
  // Rastreador
  const selRast = document.getElementById(prefix+'-tem-rastreador');
  if(selRast){ selRast.value = v.tem_rastreador ? 'sim' : 'nao'; _toggleRastreador(prefix); }
  s('rastreador-empresa', v.rastreador_empresa);
  // Anexos existentes
  _renderAnexosExistentes(prefix, v.anexos_urls);
  // IPVA
  try{ _veicIpvas = v.ipvas ? JSON.parse(v.ipvas) : []; }catch(e){ _veicIpvas=[]; }
  _renderIpvas(prefix);
  // Manutenções
  try{ _veicManutencoes = v.manutencoes_veiculo ? JSON.parse(v.manutencoes_veiculo) : []; }catch(e){ _veicManutencoes=[]; }
  _renderManutencoes(prefix);
}

// veiculos.js — Gestão de veículos

function statusBadge(s){
  return s==='preparacao' ? '<span class="badge badge-blue">⚙️ Em preparação</span>'
    : s==='disponivel' ? '<span class="badge badge-green">Disponível</span>'
       : s==='alugado'    ? '<span class="badge badge-red">Alugado</span>'
       : s==='reservado'  ? '<span class="badge badge-blue">Reservado</span>'
                          : '<span class="badge badge-yellow">Manutenção</span>';
}

function renderVeiculos(){
  const map={carro:'carros', moto:'motos'};
  Object.entries(map).forEach(([tipo,key])=>{
    const search=(document.getElementById(`s-${key}`)?.value||'').toLowerCase();
    const sf=document.getElementById(`f-${key}`)?.value||'';
    const data=allVeiculos.filter(v=>v.tipo===tipo&&(!sf||v.status===sf)&&(!search||`${v.marca} ${v.modelo} ${v.placa}`.toLowerCase().includes(search)));
    const tb=document.getElementById(`tb-${key}`);
    if(!tb) return;
    const canEdit=['admin','atendente'].includes(currentPerfil?.perfil);
    tb.innerHTML=data.length?data.map(v=>{
      const inv = allPerfis.find(p=>p.id===v.investidor_id);
      const invBadge = inv ? `<span style="font-size:10px;color:#7c3aed;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.15);border-radius:4px;padding:2px 6px">📈 ${inv.nome.split(' ')[0]}</span>` : '';
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div class="vi ${v.tipo==='carro'?'vi-car':'vi-moto'}">${SVG_VEICULO(v.tipo)}</div>
          <div>
            <div style="font-weight:500">${v.marca} ${v.modelo}</div>
            <div style="font-size:11px;color:var(--muted)">${v.cor||''} · ${v.cambio||''} ${invBadge}</div>
          </div>
        </div></td>
        <td>${v.placa}</td>
        <td>${v.ano||'—'}</td>
        <td>${(v.km_atual||0).toLocaleString('pt-BR')}</td>
        <td style="color:var(--accent);font-weight:600">R$ ${(v.diaria||0).toFixed(2)}</td>
        <td>${statusBadge(v.status)}</td>
        <td>${canEdit?`
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="verHistorico('${v.id}')">📋 Histórico</button>
            <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="editarVeiculo('${v.id}')">✏️ Editar</button>
            <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px;color:var(--red);border-color:rgba(220,38,38,.2)" onclick="excluirVeiculo('${v.id}','${(v.marca+' '+v.modelo).replace(/'/g,"\\'")}','${v.placa}')">🗑️</button>
          </div>`:'—'}</td>
      </tr>`;
    }).join(''):'<tr class="empty-row"><td colspan="7">Nenhum veículo encontrado</td></tr>';
  });
}

// ── EDITAR VEÍCULO ──
async function excluirVeiculo(id, nome, placa){
  if(!confirm(`Excluir veículo "${nome} (${placa})"?\n\nAtenção: só é possível excluir veículos sem locações ou contratos vinculados.`)) return;
  try{
    const {error} = await sb.from('veiculos').delete().eq('id', id);
    if(error){
      if(error.message.includes('foreign key') || error.code === '23503'){
        notify('Não é possível excluir — este veículo tem locações ou contratos vinculados.','error');
      } else {
        throw error;
      }
      return;
    }
    notify(`Veículo "${nome}" excluído.`,'success');
    await loadVeiculos();
    renderDashboard();
  }catch(e){ notify('Erro ao excluir: '+e.message,'error'); }
}

function editarVeiculo(id){
  const v = allVeiculos.find(x=>x.id===id);
  if(!v) return;
  document.getElementById('ev-id').value   = v.id;
  document.getElementById('ev-tipo').value  = v.tipo;
  document.getElementById('ev-marca').value = v.marca||'';
  document.getElementById('ev-modelo').value= v.modelo||'';
  document.getElementById('ev-placa').value = v.placa||'';
  document.getElementById('ev-ano').value   = v.ano||'';
  document.getElementById('ev-cor').value   = v.cor||'';
  document.getElementById('ev-cambio').value= v.cambio||'Automatico';
  document.getElementById('ev-km').value    = v.km_atual||0;
  document.getElementById('ev-diaria').value= v.diaria||'';
  document.getElementById('ev-status').value = v.status||'disponivel';
  _preencherCamposExtras('ev', v);
  document.getElementById('ev-obs').value   = v.observacoes||'';
  preencherSelectInvestidores('ev-investidor').then(()=>{
    const sel = document.getElementById('ev-investidor');
    if(sel) sel.value = v.investidor_id||'';
  });
  document.getElementById('m-editar-veiculo').classList.add('show');
}

async function atualizarVeiculo(){
  const id = document.getElementById('ev-id').value;
  if(!id) return;
  const obj = {
    tipo:         document.getElementById('ev-tipo').value,
    marca:        document.getElementById('ev-marca').value.trim(),
    modelo:       document.getElementById('ev-modelo').value.trim(),
    placa:        document.getElementById('ev-placa').value.trim().toUpperCase(),
    ano:          parseInt(document.getElementById('ev-ano').value)||null,
    cor:          document.getElementById('ev-cor').value.trim(),
    cambio:       document.getElementById('ev-cambio').value,
    km_atual:     parseInt(document.getElementById('ev-km').value)||0,
    diaria:       parseFloat(document.getElementById('ev-diaria').value)||0,
    status: document.getElementById('ev-status').value,
    ..._coletarCamposExtras('ev'),
    observacoes:  document.getElementById('ev-obs').value.trim(),
    investidor_id:document.getElementById('ev-investidor')?.value||null,
  };
  if(!obj.marca||!obj.modelo||!obj.placa){notify('Marca, modelo e placa obrigatórios','error');return;}
  const btn = document.querySelector('#m-editar-veiculo .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try{
    // Upload novos anexos
    const novosUrlsEv = await _uploadAnexos('ev', id);
    const existentesEv = _coletarAnexosExistentes('ev');
    const todosAnexos = [...existentesEv, ...novosUrlsEv];
    obj.anexos_urls = todosAnexos.length ? JSON.stringify(todosAnexos) : null;
    const {error} = await sb.from('veiculos').update(obj).eq('id',id);
    if(error) throw error;
    notify('Veículo atualizado!','success');
    closeModal('editar-veiculo');
    _veicAnexosNovos['ev']=[]; window._veicAnexosRemovidos['ev']=[];
    await loadVeiculos(); renderDashboard();
  }catch(e){
    notify('Erro: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='✓ Salvar alterações';}
  }
}

// ── CADASTRAR VEÍCULO ──
async function preencherSelectInvestidores(selectId='mv-investidor'){
  if(!allPerfis || allPerfis.length === 0){
    const {data} = await sb.from('perfis').select('*').order('nome');
    allPerfis = data||[];
  }
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const investidores = allPerfis.filter(p=>p.perfil==='investidor');
  sel.innerHTML = '<option value="">— Nenhum (frota própria)</option>' +
    investidores.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
}

async function salvarVeiculo(){
  const tipo         = document.getElementById('mv-tipo').value;
  const marca        = document.getElementById('mv-marca').value.trim();
  const modelo       = document.getElementById('mv-modelo').value.trim();
  const placa        = document.getElementById('mv-placa').value.trim().toUpperCase();
  const ano          = parseInt(document.getElementById('mv-ano').value)||null;
  const cor          = document.getElementById('mv-cor').value.trim();
  const cambio       = document.getElementById('mv-cambio').value;
  const km           = parseInt(document.getElementById('mv-km').value)||0;
  const diaria       = parseFloat(document.getElementById('mv-diaria').value)||0;
  const obs          = document.getElementById('mv-obs').value.trim();
  const investidor_id= document.getElementById('mv-investidor')?.value||null;
  if(!marca||!modelo||!placa){notify('Marca, modelo e placa são obrigatórios','error');return;}
  if(!diaria){notify('Informe o valor da diária','error');return;}
  const _cpfPropMv = document.getElementById('mv-cpf-cnpj-prop')?.value||'';
  if(_cpfPropMv && !checarCpfCnpj(_cpfPropMv,'CPF/CNPJ do proprietário', true)) return;
  const btn = document.querySelector('#m-veiculo .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try{
    const extrasMv = _coletarCamposExtras('mv');
    const statusMv = document.getElementById('mv-status')?.value||'disponivel';
    const {data: vInserido, error}=await sb.from('veiculos').insert({
      tipo,marca,modelo,placa,ano,cor,cambio,km_atual:km,diaria,observacoes:obs,
      investidor_id:investidor_id||null, status:statusMv, ...extrasMv
    }).select().single();
    if(error) throw error;
    // Upload de anexos após obter o ID
    const novosUrls = await _uploadAnexos('mv', vInserido.id);
    if(novosUrls.length){
      await sb.from('veiculos').update({anexos_urls: JSON.stringify(novosUrls)}).eq('id', vInserido.id);
    }
    notify('Veículo cadastrado com sucesso!','success');
    closeModal('veiculo');
    _veicIpvas=[]; _veicManutencoes=[]; _renderIpvas('mv'); _renderManutencoes('mv');
    _veicAnexosNovos['mv']=[]; _renderAnexosLista('mv');
    ['mv-marca','mv-modelo','mv-placa','mv-ano','mv-cor','mv-km','mv-diaria','mv-obs',
     'mv-seguradora','mv-apolice','mv-seguro-vencimento','mv-seguro-valor','mv-seguro-periodicidade','mv-rastreador-empresa'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    const sel=document.getElementById('mv-investidor'); if(sel) sel.value='';
    const selRast=document.getElementById('mv-tem-rastreador'); if(selRast){ selRast.value='nao'; _toggleRastreador('mv'); }
    await loadVeiculos(); renderDashboard();
  }catch(e){
    notify('Erro ao salvar: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='✓ Salvar';}
  }
}
