-- ============================================================
-- 005-galao-de-agua.sql
--
-- "Galão" sozinho não diz do quê. No balcão de uma revenda de gás,
-- galão pode ser de qualquer coisa; na mensagem do WhatsApp e na
-- lista de preços, o nome precisa se explicar sem o desenho do lado.
--
-- Só o nome e o apelido mudam. O id fica, e com ele todos os preços
-- que as revendas já cadastraram.
--
-- O de 5 litros deixa de ser "garrafão": é o mesmo galão, menor, e
-- dois nomes para a mesma coisa confundem quem compara preço.
--
-- Rode inteiro no SQL Editor, depois do 004.
-- ============================================================

begin;

update itens set nome = 'Galão de água 20 litros', apelido = 'Galão de água 20L'
 where tipo = 'agua' and apelido = '20L';

update itens set nome = 'Galão de água 10 litros', apelido = 'Galão de água 10L'
 where tipo = 'agua' and apelido = '10L';

update itens set nome = 'Galão de água 5 litros', apelido = 'Galão de água 5L'
 where tipo = 'agua' and apelido = '5L';

commit;
