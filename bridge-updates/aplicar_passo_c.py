#!/usr/bin/env python3
"""
Aplica automaticamente as mudanças do PASSO C no bridge server:
captura o wpp_message_id das mensagens recebidas via webhook.

Uso:
    python3 aplicar_passo_c.py /root/fleetpro-bridge/fleetpro-bridge-server.js

O script:
  1. Faz backup do arquivo original (.bak com timestamp)
  2. Aplica as 3 substituições de texto exatas
  3. Roda `node --check` no resultado
  4. Se a sintaxe falhar, RESTAURA o backup automaticamente e avisa
  5. Se tudo OK, mostra um diff resumido do que mudou
"""

import sys
import subprocess
import shutil
import datetime

def main():
    if len(sys.argv) != 2:
        print("Uso: python3 aplicar_passo_c.py /caminho/para/fleetpro-bridge-server.js")
        sys.exit(1)

    caminho = sys.argv[1]

    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            conteudo_original = f.read()
    except FileNotFoundError:
        print(f"ERRO: arquivo não encontrado: {caminho}")
        sys.exit(1)

    conteudo = conteudo_original

    # ── SUBSTITUIÇÃO 1 — declarar wppMessageId junto das outras variáveis ──
    velho_1 = "let numero = '', texto = '', tipoMsg = 'text', mediaUrl = '', fromMe = false, nomeCliente = '';"
    novo_1  = "let numero = '', texto = '', tipoMsg = 'text', mediaUrl = '', fromMe = false, nomeCliente = '', wppMessageId = null;"

    if velho_1 not in conteudo:
        print("ERRO: não encontrei o trecho da SUBSTITUIÇÃO 1 no arquivo.")
        print("Trecho esperado:")
        print(f"  {velho_1}")
        print("O arquivo pode já ter sido modificado, ou a versão é diferente da esperada.")
        sys.exit(1)
    conteudo = conteudo.replace(velho_1, novo_1, 1)

    # ── SUBSTITUIÇÃO 2 — capturar o id da mensagem no formato body.data.key ──
    velho_2 = "numero = d.key.remoteJid.replace(/@s\\.whatsapp\\.net|@g\\.us/g, '');"
    novo_2  = "numero = d.key.remoteJid.replace(/@s\\.whatsapp\\.net|@g\\.us/g, '');\n      wppMessageId = d.key.id || null;"

    if velho_2 not in conteudo:
        print("ERRO: não encontrei o trecho da SUBSTITUIÇÃO 2 no arquivo.")
        print("Trecho esperado:")
        print(f"  {velho_2}")
        sys.exit(1)
    conteudo = conteudo.replace(velho_2, novo_2, 1)

    # ── SUBSTITUIÇÃO 3 — gravar wpp_message_id no insert principal ──
    velho_3 = """const { data, error } = await sb.from('wpp_mensagens').insert({
        cliente_id: clienteId, numero, texto, tipo: tipoMsg,
        direcao: (fromMe || isSara) ? 'saida' : 'entrada',
        media_url: mediaUrl || null
      }).select().single();"""
    novo_3  = """const { data, error } = await sb.from('wpp_mensagens').insert({
        cliente_id: clienteId, numero, texto, tipo: tipoMsg,
        direcao: (fromMe || isSara) ? 'saida' : 'entrada',
        media_url: mediaUrl || null,
        wpp_message_id: wppMessageId
      }).select().single();"""

    if velho_3 not in conteudo:
        print("ERRO: não encontrei o trecho da SUBSTITUIÇÃO 3 no arquivo.")
        print("Trecho esperado (indentação e espaços importam):")
        print(velho_3)
        sys.exit(1)
    conteudo = conteudo.replace(velho_3, novo_3, 1)

    # ── BACKUP ──
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    caminho_backup = f"{caminho}.bak_{timestamp}"
    shutil.copy2(caminho, caminho_backup)
    print(f"Backup salvo em: {caminho_backup}")

    # ── ESCREVER O ARQUIVO MODIFICADO ──
    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    print(f"Arquivo modificado: {caminho}")

    # ── VALIDAR SINTAXE ──
    resultado = subprocess.run(['node', '--check', caminho], capture_output=True, text=True)
    if resultado.returncode != 0:
        print("\nERRO DE SINTAXE após a modificação. Restaurando backup automaticamente...")
        print(resultado.stderr)
        shutil.copy2(caminho_backup, caminho)
        print(f"Arquivo restaurado a partir de {caminho_backup}. NENHUMA mudança foi aplicada.")
        sys.exit(1)

    print("\n✓ Sintaxe validada com sucesso (node --check).")
    print("✓ As 3 substituições foram aplicadas corretamente.")
    print("\nPróximo passo: docker service update --force fleetpro-bridge")

if __name__ == '__main__':
    main()
