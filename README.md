# Supernatural · Arquivo de Caçadas — GitHub Pages

Site estático com as 15 temporadas e 327 episódios. Os arquivos deste diretório estão prontos para publicar no GitHub Pages; não exigem Python, banco de dados ou configuração de domínio para a publicação. O Python é usado apenas para o teste local.

## Publicar

1. Crie um repositório no GitHub.
2. Extraia o ZIP e envie **todos os arquivos da pasta extraída, inclusive `.nojekyll`**, para a raiz do repositório na branch `main`.
3. No repositório, abra **Settings → Pages** e selecione **Deploy from a branch → main → /(root)**; salve.
4. Acesse o endereço mostrado pelo GitHub, normalmente `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. As páginas internas usam `#/temporada/1`, `#/minha-lista`, `#/andamento` e `#/ajustes`, então o botão Voltar e os links funcionam mesmo após atualizar a página.

O site **não precisa** de DNS nem de Nginx para esse endereço. Se desejar um link no seu domínio mais tarde, pode criar um atalho para o endereço do Pages, sem mudar o aplicativo.

## Testar no computador e no celular

No terminal do Linux, na pasta extraída:

```bash
bash testar_localmente.sh
```

O script mantém a porta **5000** aberta enquanto estiver em execução e imprime os endereços de acesso para o PC e o celular. Use a mesma rede Wi-Fi; encerre com **Ctrl+C**. Se houver firewall ativo, permita conexões TCP de entrada na porta 5000 na sua rede local. O acesso local por IP não oferece o seletor de pasta em navegadores que exigem HTTPS; o download manual e as marcações locais continuam funcionando. No GitHub Pages (HTTPS), o seletor aparece nos navegadores que o suportam.

## Contas e backups

- Cada navegador cria suas próprias contas e guarda suas próprias marcações. Usuários repetidos só são impedidos **no mesmo navegador**, inclusive quando variam maiúsculas/minúsculas. A senha só separa os perfis nesse navegador; não é um login remoto ou uma proteção dos dados contra alguém com acesso ao dispositivo.
- Cada marcação é gravada imediatamente no armazenamento local com uma cópia automática adicional no **mesmo navegador**. Limpar os dados do site, trocar de aparelho ou usar uma aba privada pode apagar ambas as cópias. **Guarde também arquivos de backup.**
- Em **Conta → Escolher pasta**, o navegador pode pedir que você escolha uma pasta, preferencialmente `Documentos`. Após você permitir escrita, o site cria `Guia de Episódios Supernatural` dentro da pasta escolhida e grava `Supernatural_USUARIO_AAAA-MM-DD.json`. Alterações seguintes sobrescrevem o arquivo daquele usuário e dia. A escolha e a permissão podem precisar ser renovadas pelo navegador.
- O botão **Backup ↓** do topo salva um arquivo na pasta autorizada. Se ainda não houver pasta escolhida e o navegador aceitar essa função, o botão abre o seletor. Se você negar/cancelar, nenhum arquivo é escrito e o site **não pede novamente sozinho** ao marcar episódios. A gravação normal no navegador continua.
- **Conta → Baixar arquivo** inicia um download manual onde seu navegador definir; ele não cria uma pasta `Documentos` automaticamente. Use esse botão no Safari, Firefox, navegadores móveis sem seletor de pasta, ou sempre que quiser uma cópia fora do navegador.
- **Conta → Importar arquivo** lê o JSON e mostra de qual usuário é e quantas marcações contém. Somente **Substituir minhas marcações** aplica o conteúdo à conta local atual. Senhas não são exportadas. Se tinha uma conta na versão com servidor, use o exportador abaixo; as senhas antigas não são transferidas.

### Transferir marcações da versão com servidor (opcional)

Na pasta extraída do novo site, com o arquivo `progress.sqlite3` da versão antiga acessível em seu PC, execute:

```bash
python3 ferramentas/migrar_progresso.py /caminho/para/progress.sqlite3 Rafael
```

O comando lê o banco antigo sem alterá-lo e cria um JSON com as marcações desse usuário na pasta atual. No novo site, crie uma conta local, abra **Conta → Importar arquivo**, escolha esse JSON e confirme. Faça isso individualmente para cada usuário necessário. **Nunca envie `progress.sqlite3` ou os JSONs pessoais para o repositório público.**

**Limite da versão estática:** o GitHub Pages não tem servidor para sincronizar dispositivos, controlar convites de uso único ou validar um código de proprietário. Não publique códigos privados ou bancos de dados no repositório. O painel antigo de convites foi removido porque códigos gerados apenas no navegador não restringiriam cadastros de outras pessoas. Se precisar desse controle, a versão com servidor continua sendo a opção apropriada.

## Arquivos

- `index.html`, `style.css`, `app.js`: interface existente e rotas.
- `local-store.js`: contas e marcações locais, cópia interna e exportação/importação.
- `folder-backup.js`: seletor com permissão opcional, gravação autorizada por data.
- `episodes.json`, imagens, símbolo e fontes: catálogo e identidade visual.
- `testar_localmente.sh`: teste HTTP na porta 5000.
- `ferramentas/migrar_progresso.py`: exportação opcional de marcações do banco da versão anterior.
