-- ============================================================
-- 56: COTA DE TÉCNICAS PRÓPRIAS NO SERVIDOR
--
-- Cada conta pode criar até 100 técnicas próprias, contando as
-- arquivadas e as apagadas. O app já conta antes de criar; isto
-- garante o mesmo número para quem grava direto pela API.
-- (Contrato: docs/CONTRATO-TECNICAS.md, seção 4.)
--
-- O que muda na tabela registros:
-- 1. Técnica própria (dados.propria = 1): a 101ª é recusada
--    ("limite_tecnicas"). Editar uma que já existe passa sempre,
--    mesmo com a conta cheia.
-- 2. Depois de posto, o propria não sai. Se a técnica for apagada
--    (deleted_at), o servidor mantém o propria sozinho: ela continua
--    contando.
-- 3. Técnica sem propria precisa ser do catálogo (uid na lista
--    abaixo, gerada do código do app). Linha apagada fica de fora
--    dessa conferência.
-- 4. Nome até 80 e "como você faz" até 2.000 caracteres (só confere
--    o que mudou: o que já está gravado não trava a edição).
-- 5. propria só vale em techniques.
-- 6. tabela só aceita as tabelas que o app sincroniza (check
--    "not valid": linha antiga não é conferida, linha nova e
--    linha editada são).
-- 7. Ninguém apaga de vez uma técnica própria (o app nunca apaga,
--    só marca deleted_at). As outras linhas seguem como antes.
-- Select, insert e update continuam só com auth.uid() = user_id.
--
-- A recusa sai com o código 23514 e o motivo no começo da
-- mensagem. O sync (S1) deixa o registro na fila com esse motivo,
-- que aparece em Ajustes. Nada some.
--
-- ORDEM: só rode depois que os aparelhos já marcam propria nas
-- técnicas criadas (Frente B no ar e aberta pelos alunos). Antes
-- disso, a técnica própria antiga sem propria seria recusada ao
-- ser editada. Confira antes com a consulta do fim deste arquivo.
--
-- Pode rodar de novo sem problema.
-- Lista do catálogo: gerada por  node scripts/teste-cota-sql.mjs --gerar
-- (o teste reprova se o seed mudar e a lista não).
-- ============================================================

-- ---------- os números (iguais aos de src/lib/limites.js) ----------
create or replace function public.limite_tecnicas_proprias()
returns integer language sql immutable as $$ select 100 $$;

create or replace function public.nome_tecnica_max()
returns integer language sql immutable as $$ select 80 $$;

create or replace function public.detalhes_tecnica_max()
returns integer language sql immutable as $$ select 2000 $$;

-- propria = 1 (número, como favorita e arquivada)
create or replace function public.tecnica_e_propria(d jsonb)
returns boolean language sql immutable as $$
  select coalesce(d->>'propria', '') in ('1', 'true')
$$;

-- ---------- uids do catálogo ----------
-- O uid de cada técnica do seed (sai do nome antigo, quando teve),
-- os uids das cópias que foram juntadas (juntou) e os dos nomes
-- antigos de src/db/renomeios.js (o sync também os trata como
-- biblioteca).
create or replace function public.uids_catalogo_tecnicas()
returns text[] language sql immutable as $$ select array[
-- uids: início
'00199c8b-ca87-4b70-a3af-6b24637771d7', '0020c577-d30a-419b-af51-35f36f7fdd6d', '006a377f-7af3-48ae-a2f3-b928c4739398', '00e4d122-d11b-492d-a3c0-c5398a0f7648',
'010ade05-69f9-40e9-ae5a-72a1271539a5', '0111efb6-e99d-4438-aff1-43ea66171e84', '017d5322-eb72-4fd1-abb0-d63d01b64306', '017ee27c-9a2c-4b65-ad1a-dcf7e7a7c50c',
'01c8bd4c-e517-4802-a1a1-047cdaac89aa', '022961c1-9c73-4b8b-af01-82552b59d905', '02bbacf4-c892-418c-a4c9-34d4807ad5c0', '03a7afac-494f-4931-ab52-db41d3af8aaf',
'041c3a74-bf39-4bc7-a185-c9e5007e4f22', '043f7d73-93e1-43c1-af60-c28ffe73f15a', '045998cc-5c14-4b4c-a3bc-056885bf2e01', '048e1d56-63ab-4d94-ad48-6a0e669ca3a6',
'0568e4b8-97fb-4b51-a74d-dfab6cf68ca0', '066cf629-f0fd-4926-adcc-5cbe8c252197', '06b32246-9add-4f46-ad70-e80ac7a0d07f', '06b81c45-28f9-4b4d-a26f-2da3bc7b19a7',
'06f007de-2203-4f28-a1e0-7f0ab64c17fc', '075f4b85-2d26-449a-a81f-124acc7f9598', '0801ffb2-1bd5-46da-aaa1-c34a071abf5c', '090cc0db-4390-4633-a7c5-40e53d5cb540',
'093ff8f4-0a1a-44c5-aecf-c3136b09984e', '095df7a3-a780-4943-a39f-fd8bf52a94f0', '09d39d0a-07b5-464d-a35b-1a079e649142', '0a8ecddf-e492-45e7-a7ea-8e7b38f28af7',
'0ac78f0d-29e1-45f1-ae3f-7a111c430cfb', '0adc3f8f-3f0f-4970-a561-2b8c53ce5b4b', '0af934dc-317d-4e89-af5a-bd9522b7763c', '0afacb3e-64d8-4508-ae1e-86269c3d5ce4',
'0b770cee-6ead-48a9-aea6-7de3823dc9ce', '0cf8c269-529e-4676-a2a2-850efbae1a64', '0d04ad8d-1e66-4fe1-a049-135133821aaf', '0d74f147-6b00-4153-a083-980b41f50437',
'0d9b1fe1-cb0b-4e04-a7e3-e61e0daa68f0', '0e013def-f8bf-47c3-a73a-34139ea44b2c', '0e9fde18-94fb-48eb-a4b8-c8e9e7f7384f', '0f864aba-4ae0-4d24-aced-caa2eec61f6d',
'105a0aa7-b357-4b51-a9ad-43eb1345ed1d', '10630039-1142-4b40-af0b-0a8e24f83cb8', '10debf91-12b6-4df9-a199-326328d25d81', '11674ff8-6ad6-4d27-ae62-dc314b9c2ae7',
'11da56e2-61f5-4f67-a325-7e3bf58f2c16', '11f418a8-5c26-4417-af7a-37351c735159', '12e4ca7c-af5a-4051-a512-653f198534b4', '1323387e-745b-4940-a6b6-9dceff0c317d',
'1435a7a4-a3e1-47b0-ac10-70281d14dea7', '14b1378f-5591-4602-a912-5b24f87f1250', '151f3b96-6e56-434c-a350-ba56641a41bc', '156e06ad-1d42-42af-a5ff-71cde0acf843',
'15cf3b5a-318d-41d5-a1ae-0b578c01a03a', '16669a24-eeba-432d-a3ed-3e0795d664b5', '16d363ae-51c1-4384-ab7a-4f2acbc103fa', '1739c956-4736-4556-ac36-351e96b6e55d',
'174dee33-ce61-4246-acf2-b3704167b377', '17cc03cd-2000-4e17-a2af-59fb1158dfc9', '18069c1e-92d0-4efb-a43f-5edb45f25ef8', '1823ad60-010d-42f2-aa3e-b4bc95eb24dc',
'1866a371-d64a-44d9-a843-b14bc4817d76', '18aa904c-f835-4bf7-ac20-be65c2236c7e', '18ca970e-e492-4349-a406-003b348dc662', '199b9cce-3d42-470d-a477-298786d33b98',
'1ade2555-df8e-476a-a306-8bd643bae360', '1b611e1d-a151-4ad6-a960-690aeb49fb27', '1be965b9-3e01-47e1-ab3e-1a19212d2bb3', '1c032034-ac15-42be-a543-101cb0d0c142',
'1c22c6f4-8a7a-4a15-a3c0-450d9885178d', '1c3cf5e2-b642-4e41-a6ad-1e1940e4883d', '1ceb99b1-2ac3-4446-ad4f-46fa1287b777', '1d0b5a5a-c1ac-4e96-a45d-12c2f05581a3',
'1d32b978-3120-41b9-a73a-f67701430b83', '1d61dd31-0d80-451f-a138-ae9908b233b5', '1daf067b-7896-4b86-ae7c-bda461dab05e', '1e3375a6-4401-4131-ad30-483d62e4298b',
'1f6fb56a-1a0a-4604-ac43-778a262a7885', '1fabe2f6-67e9-4440-acbd-dba2d536a558', '1faecaae-752b-4078-a4ea-e5da663a4570', '2066ae80-2df7-4c97-a85f-4fd9035eb8cc',
'20716bad-97af-4062-a21d-34aa5b53b060', '20d925da-6a8c-4d46-a881-4e9a0fa3f0f1', '20fbd6ff-253e-4c20-a3d5-30dc6327e734', '21f618f3-8490-4ea9-a58e-0497d3d423e0',
'2265605a-9eee-476f-a16e-5e0979ba7c85', '2275cafd-ad93-40a2-a7de-66cee931602d', '23562079-5d9f-409b-ad09-0b115da4dde6', '23797e05-6944-4cb2-a334-17d2645fa064',
'237ea6dd-535a-4d41-adb8-bb5f1a527efe', '24a5c106-fc1a-48d9-a6b1-60cd54c88e28', '25086088-633b-451e-aebe-475487761304', '2518e96b-23c3-4494-aade-a7805ddcac18',
'2587dc58-549b-4f0d-a587-4ec7ce05ad80', '25a2c6f9-7f29-47eb-a90d-5bff0124ffce', '25b8a177-1f57-4d52-a4d2-0234c03ea04b', '25f83815-92c5-44d2-ad2f-14ba2b91b28d',
'26d39bbc-69c7-49d1-ae7a-069dc58460fc', '270a86a3-2134-4dc1-a4ba-3541b69aee46', '2748f3c3-2026-4fed-a00b-7821b487f4fd', '28ee807d-feff-4b10-a899-f232e07e9404',
'28f506b2-77f7-4e8f-a775-7e810ea03147', '28f61a96-f313-4bb8-ae5c-797ed1781550', '2907227c-ef44-4597-a23e-309759ccd810', '295f0051-5f8f-41a8-a63a-d2d6b0c37fac',
'29be2146-ba96-40dd-ac4e-83afdc398f64', '2a198992-8a71-471e-a229-2e562d738d3e', '2a287924-d243-40f6-ac43-41a82ff73b46', '2a7be9ab-d4fd-4a57-a6c6-6177c7b39ef4',
'2a8fca38-4430-4cb3-a299-fa2f27e0cb61', '2afc3c3a-df26-4052-a040-9986199ad194', '2aff41fa-d02e-4f19-a8b9-b91ff0022291', '2c0bcde3-8975-4fab-a772-a6cdc19b305b',
'2c1fa33a-bf87-4f7d-afdc-1e85d2468876', '2ccb3c01-e0bf-44ca-a22e-01eed4ba0e89', '2cf1ffa3-4680-4520-a1aa-d54c1861d557', '2d1438d9-92b2-434a-a6dc-ed7e9a03c512',
'2d3338a2-77b8-4112-a98f-a52eaf3e1fe9', '2e25145f-c453-4334-a324-2080a30056c4', '2e638400-90d0-4568-a111-6aa0162c13b8', '2f15fb18-3c94-4665-a693-883938c485cd',
'2f166a07-51b5-4317-ac52-8adbff65851f', '2f94e6d1-bc94-414c-ac36-21e21f38493c', '2fae30b1-04f2-41d6-a2bd-439eb913f6e4', '2fbedddc-bf91-499e-ac32-e7bc4c267260',
'2fdebd54-39c4-48fe-ae30-b794217afa37', '3023bed8-c50f-4a98-a8f5-e338aa9fd8c9', '304826ad-d4cc-454f-a4ac-46371181a397', '30a4790b-0fd5-4314-acc1-704463c86e1e',
'30cd3540-2573-4c65-a87d-ca5b0884e52d', '30e71876-c141-49eb-ab12-f011b95fd386', '313d64d4-cf68-4df4-a224-619cb9a53a81', '31f013a3-91a9-46dd-afb2-7a4f355e6803',
'321b0a86-ebb0-410a-a725-40a2a69365fb', '3236d5df-5987-4be4-af0c-215c59ee6c99', '32743f5f-71e3-4132-a2d3-5e04e99cc772', '330335dd-4784-4168-ab30-6782f7e3a35f',
'339ee239-afc2-4173-a954-f629c1012c25', '33c5602d-edd0-40f4-a78c-33a68ca1c3ca', '340f04b7-8dde-45cb-ac1b-24af72d1c1a7', '340f93dc-36fe-43f5-ab0c-99d736006d0d',
'34b43353-e0d9-414f-a636-fd093cbc958d', '34dc849b-f648-4b38-a418-3f44819f875a', '350a9dff-ca09-4a65-ab10-299fcf230bb1', '35166e01-222e-455e-a1df-27baff21fb74',
'3537fdc5-661d-4b3b-a431-57fd6880fbc8', '357c5a8c-621d-429e-a097-d5fcd72d65a7', '35896d65-69f5-4b35-a95a-e9c501fd4db4', '358c7cde-752a-45eb-a641-3849e0755e1d',
'35a480a7-b0a8-4d2c-a420-fa783017b33f', '35dc44d0-9dc7-4857-aad5-7ff534fcae23', '3608ccaf-67ae-4cd3-a54c-4c9b2e265e6c', '372fc3c4-97d8-4ca5-af19-d563a31ac956',
'377c227f-98d4-4253-aceb-68898f0f9572', '3806d664-83bf-4213-ac56-4af3de4dabe6', '38d49ea1-4fdf-4d45-af3c-d4e9aa8e304b', '3991281a-5405-48bf-a198-b4652c1ee98a',
'3a8e488c-79b8-48c0-a6d0-4690482a8945', '3a98762f-e1ac-4e98-a752-824c03d62205', '3b0fd43e-30a4-4fcf-ae86-af05817a790c', '3b8e8ea2-91cb-4cd8-aa98-d27e2ed28347',
'3b946301-aa0b-4a2a-a4d5-eeae993bd6c3', '3c00af86-e19e-4b74-a3dc-54d67ed7256f', '3c1d5cbf-10a4-4cbf-a336-5437b9a64466', '3cdf7948-1241-4b3c-a267-da9cef4807df',
'3cf1ab43-5e59-48b7-abde-b93193f00bfd', '3d0d6a65-5cca-4f41-a183-a9adcb3e5c0d', '3d101baa-f7e0-4d08-a164-8cca881b2254', '3d7a159e-563d-489f-a75c-894b5d8f2b83',
'3d883134-d0b4-49bf-ae96-ff4dfe44d82b', '3e6e8ff1-53bc-411d-a5c5-2939cce03760', '3ffb792c-6b93-40ee-aa25-71403e76f478', '4101dc00-52e7-4121-ad09-facd7dca0531',
'41058558-119b-466f-a3aa-8b27cfcc3158', '426ec6a3-c35f-4c2c-aa87-a98cff91791b', '42b7d492-e8d0-465e-a376-d666c6b9a827', '42fbe601-d351-460d-a557-36ed42e566ce',
'4313d05b-ab15-4996-aae1-6bc4d6fddde8', '433484d7-c459-48b8-a760-496870371b45', '437b3de9-c551-40a7-ae4b-0f4da46d3522', '43ca97c9-78ab-43ed-a982-31d9705a6676',
'43cb1abe-c3d5-4865-ae46-e957393a2dec', '4487861c-81f8-4d8c-a207-862881f96926', '4578e9ca-e332-4d39-a730-bb25422ec540', '464bc123-9b89-4ee0-a600-b58c80db9688',
'476e705e-2d12-4a5f-adcd-669fac04f6eb', '4798d46e-84cf-4024-a309-9df24b1850ec', '47b3e2f0-768c-4327-adb7-8451c689f97a', '481f86dc-8238-4ca5-af94-b7c361075275',
'48a36634-9a89-4409-a4bf-6f4dd63c647a', '49641968-86d6-4373-af3a-65eb9d208b21', '49f21842-a9d4-4716-a240-64f2e9e7a3bd', '4a11d551-dcdc-49b9-ab4f-dd812b48f41e',
'4a6f64a3-1d97-4c87-a8fa-598166adff07', '4ae2e28e-eac8-4885-aa35-5b3354ee11f5', '4b31e908-eec0-4779-af8d-fd3502f767ec', '4b442c2c-8a14-42fd-a7e0-798530be5bf7',
'4c358a62-afc7-46c5-a2b8-55410d01e1be', '4c40468f-17d2-4ec5-ae47-2657984353f2', '4c49d599-9af0-4361-a7d5-377b1138842b', '4cbb49bc-5f7e-4132-afda-b37cc8cc7b57',
'4d48fb51-ad0d-4c23-ade7-2b85f30d03a7', '4ebcbd42-120f-4485-a202-2ba1e42d88c4', '4f465ea1-59ed-4585-a84b-4b33447b1406', '4fb19fcd-3ce3-410b-a9e5-9051e67fffd0',
'50b99f97-456c-48cb-aa6b-ab5f91a26d3f', '5126b87f-88cf-4192-a082-3db4aa14da63', '5302cce2-96c1-40eb-a26d-113fd3fa0e1c', '530ba5ab-dcd8-4930-a604-3be4f5b6b6db',
'53407cb9-3c30-4119-a10d-ecad9d0051b3', '5343221a-70d4-4348-a206-a676f602303c', '5417ef14-a416-4972-a92c-bab89624db69', '545395fb-e302-41a3-a03c-734561a2f25c',
'55b7e404-2cee-48d7-ad8d-dbb7e74420e9', '5619bfe5-fa1f-4967-af57-ce2b148f4e24', '564cd669-596a-4c62-a597-a0dedf567140', '581132ce-b7b7-4d16-ab80-d04aa30a3dbf',
'585f91b8-9345-49d5-a4af-087f2b1b8f8e', '58f52ef8-900b-4048-afef-59e0c7cd40ce', '59aaf425-e4cd-4f84-ab4b-cc222589d534', '59af841d-0413-459c-a678-63c294b89afb',
'59e7f510-ae60-43c8-a3e1-7cccf9a1b1a5', '5a6d2248-2718-47d1-ade9-8e8f7c8b27b7', '5b2be1ad-e773-4fa6-af7f-5e6631aef4c0', '5bc19397-401b-4a69-a6be-a19524e6cbb3',
'5bc9304c-0a75-4e21-af37-b22d0b2dd2dc', '5bdc5141-0ba8-4673-a11b-ae25f51988c6', '5bf8e13d-65c7-40f6-a20d-5fee6eecafd8', '5c31d8a5-a1ea-476a-acfb-08ca1ba922f9',
'5cbe086d-3560-40c0-a3e4-8afef6653083', '5ce7d066-4339-4d25-ace1-6e419c986f1c', '5d6d34aa-ae97-4f2d-a1bc-ed41a74754c0', '5d6fadc9-9fef-45a2-a4fc-330e40505853',
'5dea5990-2987-41e5-a529-7ca330db35ef', '5dee3cec-daad-425a-ac4e-47748f30fd90', '5e49db0d-e97b-47f9-a1b7-bb673077ded5', '5f98b171-2ab7-42be-a59d-be063e0ba6ba',
'5fecf2c5-a678-48a2-a2c4-da9296d84402', '602cbe48-e4ba-47c5-a4e3-bc1ff8049619', '60a98ce4-40b0-476b-a3ee-ca7b7d381ecc', '60f53396-a3bd-4f35-ad5b-66f3c597e14b',
'6108aa7e-c47c-4cb1-a000-4f355753dc8a', '61539959-39a6-4db1-ad1e-30e1d163cd69', '6161aadd-c334-4629-a174-e7dbbc2986be', '638a21a2-849e-4eb8-aa3c-ec5a8ade6e32',
'63a0804d-8167-4160-a902-558ec6d7d373', '64a6a3e9-93a8-4141-aa28-0ef176fd0581', '64d47c96-eda5-4dc3-ae48-e9c1dadaf4e8', '651aa868-c43e-454d-aedc-ed2f0489da20',
'66d740de-214d-4c15-afa0-6d3962aff95a', '672eed7a-9b6b-4703-a118-a103cd81e8a1', '684b2959-4213-4916-a18d-459675f3b195', '686a02a8-25e8-406d-a70f-1d7b7e58573b',
'687721c8-7dea-4dda-af52-f4ac0c01dfa9', '69156762-c072-4361-afdb-1ef115eded1d', '69979173-2c16-4dda-a4ba-092849930785', '69bf9973-3208-4416-ab68-e0acdce21fb9',
'6a4f0cf8-a333-4ce0-a538-f0849bc22fa7', '6a758ec6-7623-446b-a1f5-0fc9fc857acc', '6ab0a16c-771a-4468-a332-8aacdc0f826f', '6ac9bf6d-c386-4172-a4ec-f74a412a77cd',
'6c289c7b-66b4-4f50-a970-9608d2ccd572', '6c328cd1-a74d-4f28-a05b-368e2f5b20a0', '6dc8e189-4fe6-423c-a303-b5eafdfba619', '6e3bf517-96b5-499d-abf5-4e6d7c11fb59',
'6ee0412d-d7f5-498d-a186-cc79b38cbc9c', '6f31e9c4-079f-425e-a101-ba44200e7413', '6f761925-fb1d-4558-af55-a62235842596', '6fec925b-3c7c-43c2-aa2c-76ac96252822',
'7125d2d0-474a-4b70-ac25-c120aeac4ec6', '7127142c-c6e2-4233-a82f-a6cd0980c006', '715b725a-6bdf-4c10-aa3a-4a46c81afb39', '72558cf5-eddb-4952-a394-d05ebaa86009',
'729fd78b-b7d6-49d1-a124-2a3d88b100a7', '72f27231-3a8b-4446-a16c-5e0a08283ad8', '735653d2-e123-4303-abab-1fe135fd3128', '7396df1e-5c43-47af-a0e4-d86d9d338a1d',
'73b36ea2-0ca3-44b6-a081-5b6e5d88f71d', '73de7906-52f9-4fb7-a5d3-4b15b275b54c', '7419fed7-d7bf-467c-ae12-597cce125268', '743e5ba2-9cb7-401d-ad08-c1c793790794',
'7493ab4c-dff0-4225-a910-1ff99e016b7e', '74b06143-5123-4c7e-af76-ca7822f685e0', '74d0da6d-07b9-4c9e-a1b0-66b6f2cd1db8', '753a8dd5-c090-4d0f-a399-a6573663f8c2',
'754c80f5-57d3-4dbd-a4d9-d43da73f5c4a', '75b62b5d-8c49-42cd-a522-7d7b8f1bdd49', '7715c0ea-8dae-4a0f-aa34-3187915da6c0', '771741e6-1d99-4598-a9b4-f1faefae8da1',
'771f0714-0bb4-4ff2-a361-9a94a283fde4', '77229286-15d0-49d7-afcb-6c6ba0d112c8', '77f9473e-014e-4ff4-a754-ce56aa308856', '78c0402c-9f65-4c8f-ab86-2eedcc53449c',
'7922a06e-4745-4b96-aaee-020e69da1ac7', '79427dc3-6129-480f-a7e8-302d9e4b28e8', '7978c9c7-6073-49ac-ad69-084ce9c34a39', '79a9db0c-7f07-4d86-ad06-a934eb027874',
'79b20289-cb54-44ce-ad98-673634b7fab8', '79d51a10-819d-4c4f-a3ec-6dd3488665b0', '79fec7ba-7583-4167-a112-7ddb584491df', '7a617b50-f063-4420-a272-e97c34b9de0f',
'7b06972b-934d-4799-a400-cae9618ee82b', '7c338f7b-b994-41bc-aa91-eb08c103e76b', '7d09ebb0-ecb5-4bc9-a958-550756a6de8c', '7d8adca3-111d-471d-a077-37895a22fd71',
'7e9a7408-0262-44cc-a8f4-7628ad1fd300', '7fbbe3f2-86cf-4ca4-a427-682eed54017b', '7ffd86d4-699e-418e-ac6d-570002963c2c', '80853353-89cc-4369-a6be-686f17ee1ba5',
'80a208f8-358d-4df2-ada0-b1002090514b', '80d30fd9-752b-476c-a907-1ba2ebe4ca2b', '8113ff88-31b4-42f1-a05f-42c92b625833', '819b3638-4803-4f36-a3b3-080cc17c9d6b',
'81ce77f8-ed5a-480f-af53-4d71890ca068', '820d1a07-4518-473f-a917-69cdf67ba94c', '823f6f3e-f001-4d9f-aaa6-efbf7fff702f', '824e0427-d78e-41f8-accf-99f094eed749',
'831fcc47-4af2-4337-abb7-905d91de2829', '83452190-ec0d-49fb-a988-a77fc0695269', '83574d10-33c9-43ee-af70-c4d052f22867', '83723aea-8c4e-4581-abed-d923ba6dae7f',
'8416bac8-a4e8-4197-affa-af43c09a5aed', '84317413-7b37-4be2-aca6-d6a4455abef7', '848dd4cf-44d3-42e5-af98-4d75cf4a08cb', '849f0db9-7812-408b-a591-2e6992c163dd',
'853d83f0-5bcf-4d77-afd4-8df98ca92117', '858acbf7-8066-4e7d-af78-5ecbe1181bca', '85e0c4f8-ba38-43bf-afda-593ddeb68357', '864e498b-51bf-46b4-acc6-62c85fca5627',
'87314d7a-d9cc-4254-a63a-83a2e48bd3e0', '874cf09b-1c7d-400c-a8e0-b90c43c63a60', '896e3b53-52d3-4e6a-ae1e-dadce71beeaf', '8a5beb31-5fa6-4f1f-a257-43315b1cd5db',
'8a8d5426-f41f-4fe0-ab6c-629adddf5f7a', '8ab6c5b9-8ccd-41e6-a4b6-469a35522fe6', '8ae9fbf1-5f4c-49d3-a674-4527ec5742c4', '8b40a758-c22d-40b3-a283-e66792d87b6d',
'8c53f312-cdc4-4bb4-abe8-234a21de80c8', '8c6b6a7e-1d10-43cc-ac06-e86202bf8e72', '8c791a53-2815-4ebe-ab03-2830aa812513', '8c7f1afb-82d9-47c8-af5c-6a0cf2bbadd7',
'8c8fc063-8e2e-495b-a668-ebefde0d6d7c', '8cb90133-5bb3-4db4-a18d-985c49e622c3', '8d083e27-5ac0-45e3-a099-e1a10c0dd35e', '8d3bf243-cf19-4ac3-ad9e-d43f7c0930ed',
'8dc563cd-b96a-47fe-aefb-303a3f8a28bc', '8df6ed8d-5312-4af6-a0a0-b072098dbf95', '8ec29f09-0928-44f8-a5f5-fe3e51b36227', '8eea0059-53c5-4832-a157-c02a292cb2aa',
'8f4a99c1-2699-419c-a8d8-de3ef7c559ac', '8f91ee02-53b5-48d9-ad24-e38f718580ea', '8fd04d46-9108-40be-a07a-ad36c517978e', '8fd7e2c1-6d9c-47c4-a17d-3d32761e580a',
'8fee3d0c-4a14-40e4-a2e8-442c0536c6c5', '91bcf960-a2c1-4ea9-a830-0f5f5d9ea694', '9385774a-4b77-4bec-a2fe-472ad85cf836', '93f10738-e83a-41b3-a6e2-84411a7c4180',
'950ade60-918b-4ecc-a997-641cb4127b70', '95419913-f077-4a9e-ad71-e1e050086bcb', '9549a842-d919-4eb5-aa17-92b972996d83', '957817db-f4de-4033-a761-ef57e4f66f2a',
'95ac2062-366d-4136-a7de-abe616fe9f96', '95fd9494-1597-4d42-a982-26b86ae6b54e', '96ebcb4a-47d0-493a-acbd-c8eacc692968', '9713b18e-b125-40e0-abd3-ce2a74bd1ce3',
'97830afd-a99f-404e-ad3f-331e9f08f86a', '97ab240f-2d6f-4ab5-a65c-099b5031b10b', '97ad86a4-b129-4981-a235-1b5b02bacfa8', '97c64e0e-d05c-4750-aac2-78a2f00d2d06',
'9872e763-22ae-4373-a50b-9e5906585174', '98c711b1-32b3-4f2d-ac14-0de18c11ea46', '98c9a788-d184-4e0d-a07e-7c85760402e8', '98f5b149-804f-4a48-a6c0-e5aa4690485c',
'99977623-77b3-4d60-a455-f5bc1f970f23', '99f22ddc-458d-4dcd-a9ea-ea9966865b60', '9acb89f6-0274-4158-ada8-d7a253fcbb90', '9b55a2bd-f4a8-4aff-a81a-a68105cf5b9e',
'9b8e207c-f9a4-42dd-a761-38f3cba50148', '9c7f12c5-34db-4215-a2ff-426170b830aa', '9d30dd67-d2e8-4e81-ab99-ac13327e0f99', '9de546c5-6deb-4db2-ae99-3ebe7bc98faa',
'9e3ffd7c-08da-4424-a793-42ece6519c61', '9e95333b-e91d-475e-a4ea-e514b0ae9242', '9edae75d-a097-4eb4-a693-ce02546456b8', '9efd4c49-3ed4-4fbe-a416-c59ef53b2e1b',
'9f4b78d7-0ca2-42f6-ac71-e6c4037593b9', '9f51d938-c518-4158-a2a1-9e48038f3b72', '9f82974b-d7ba-4e1d-ae80-641973cd18c4', '9fa94563-8edc-456a-ae4f-4d1c1d7a3b4b',
'a05d97bf-a969-4358-a925-ce90be8312f7', 'a05f097e-0755-4ce5-a4d7-93ddcc6dd185', 'a06c452f-b656-4432-af87-42d40b239ee1', 'a07842dc-f378-4fb1-a7c6-7ce9248a9611',
'a118abb2-1380-466e-a7d8-e1422fc4620f', 'a1466cec-4ace-4795-a3e2-7fe78a3b04cf', 'a1556051-ecce-4cb4-ad36-327ec09bf38a', 'a178843f-b481-48c9-ae78-88db7a3ca46c',
'a1c44131-c023-4e99-af04-e325ae81df00', 'a1f21fc9-7887-46c7-af5d-2d43bde6c6a8', 'a24182f6-b624-44c8-a670-d5be9a6fd37b', 'a2727e83-3a21-47ba-a377-0d7080155d88',
'a2a80f06-25b1-420c-af07-d97252b23ab5', 'a2b8cbc2-ea23-4caf-a94e-838b92fb7018', 'a2c47756-9dd4-42c6-a286-3ae6a4cd519c', 'a2cd68c2-eb66-44cb-afc0-ffcfecbd0a48',
'a2e4ae1c-5f74-4fe1-a2b8-b10f77743a5a', 'a3bb4941-49d0-4fb7-a128-77bd4d40cd81', 'a3d8f118-4db2-4c2c-a7c8-a9fcc477f859', 'a415c9a3-c250-43cc-a6d7-457ccc56c7cb',
'a419e10b-1991-4474-a309-59c43f41711e', 'a4a80a39-5610-4dca-a7b1-42c2652eab77', 'a5fbcf53-23ea-4033-a3a3-827757c51c3b', 'a6e5dbd9-8bde-46cc-a940-60aeff528722',
'a73448a2-080c-40cc-ae14-c50298d4ed12', 'a74db9ad-d309-41b4-aa7b-8e023bb616fb', 'a786ac43-580f-4a68-a4b9-29906f6e7f92', 'a7e5cca1-78c1-4100-ada2-b45a6a65b969',
'a86acf0f-b960-4b5f-ad78-8401d6248ade', 'a8baf4ed-62f3-4da5-ab48-b2c944025a5c', 'a91ba57e-ad15-4d4e-a4a2-e562962f4c00', 'a9407bcb-b44b-40fc-a6e3-762c41e4a088',
'a9e5554f-5d11-4e00-a400-ffe083628d1c', 'aa176385-1aa4-46b6-ad24-e3ee69d3d278', 'aa23b335-65dc-412d-aae1-0c7958b0d4e1', 'aa6636e1-9328-4705-a21b-bf83c9b4367b',
'aa782324-9895-4977-acdb-6d9bd807b269', 'ab195374-1606-4154-ae62-86106d8b2461', 'ab253252-202a-45c5-a2a6-4327696c68a4', 'ab94e9d0-d56d-4732-af30-54646cf39ba7',
'ac2d584e-4a30-4338-a68d-c77ee5fc3ea0', 'ac42aaf7-0e96-4d94-a412-d57c28f3fa9d', 'ac93d9bd-c33f-4a13-ac77-d35598d4cd1c', 'addc83e1-c35b-4b9d-a42a-903fdc172023',
'aea8878a-0778-400c-aeaa-d3224faff3b4', 'afbdc58d-7f54-4471-a1fe-f0a7c8b6cc6e', 'b07a93b9-b248-4a76-a39f-a722ed479f4a', 'b0caf84c-411f-4fe4-a3b1-71a459fc7460',
'b0dc15c9-0306-447a-abf0-d30aa2203833', 'b12b0db9-4a72-482d-a935-2c19bf1e9164', 'b14e1534-2f50-47b8-aea0-e6ac6cc8d5bb', 'b1709efa-fddb-46f5-a846-33ed6cbff9da',
'b1808bc2-eabc-4e10-a750-e4a6e886e822', 'b1e5e245-6860-4093-ad8b-a3d3b680fb14', 'b2961c3b-7053-4cb0-ac76-033c959474ef', 'b3a12195-7750-459c-a7a8-24562e8507ae',
'b3a845f3-068e-441f-a5bf-c4b5d7315613', 'b3fba894-dfc0-4b44-af62-7588b26303a6', 'b415f937-eaab-41fd-ab55-581fc1f24c5c', 'b49fd2c7-37b4-4e0e-a97b-0ca0480910da',
'b55b2ae2-867e-4f2b-a12e-8fb1f34dce2f', 'b589e5e1-c278-4c0d-a881-c0ed64331efe', 'b653821c-2ded-40d5-adfa-55ab39fc83a4', 'b69f6670-5efa-421d-ad45-d4b906e75451',
'b709ee80-bfba-49a2-a1a8-37dccf2d0dd2', 'b70bc0df-cdde-4c3e-a002-7d949735cde1', 'b73bdfa0-0808-4a0a-a660-131c0a1c2d59', 'b780af03-c801-4a23-a132-581d7a1ee922',
'b7a1af9b-8bdd-495b-aa37-5183155f7ff1', 'b7d16cb2-d063-44b6-aac7-3316dc4d20ac', 'b7eb3d71-9f3b-4143-ab2c-d3c9fc9919e5', 'b84d0cf0-9da6-4919-af26-c95170eb19e2',
'b8c2e91c-ea3b-486f-a24c-78952f2d8cef', 'b8e0c5eb-9335-40f3-aab0-2051cbf700af', 'b938a9db-8f2d-4a32-a303-15301fdc72f3', 'b95a6208-ff56-4ae6-ac69-bc447fa4cd01',
'b9f6a61a-ead3-4a5b-ae9f-aaef42839d47', 'bac07a29-5c39-41c3-a269-aafb93a0201f', 'bae72507-b2fb-4a9c-a5c6-6ed4148236a7', 'bc3117dc-5f77-446a-ad84-8494f3d18883',
'bc47e7a6-8223-444c-a12f-18325fe0c278', 'bc7be813-b962-4743-a938-9c43f8cc0aba', 'bdfb8010-fdfe-4ff2-a1f2-5d8492cca779', 'be5479b5-c38a-43a9-ac49-126ff213a2a6',
'bf56a4f6-f216-4842-a22a-01c696a3b71d', 'bf75de22-3f94-4120-a5ed-3c32a4b0a84c', 'bf9e9dc6-f7ca-430d-a75e-197992db6527', 'c011fd35-2586-4314-a165-cf26666e6067',
'c0ea1abc-4321-49ce-ac94-381cb2c44cdf', 'c1104363-68d8-44cc-ac6f-30a4d326509b', 'c1307fd5-f75d-4e79-a9d6-1c6d4a51c040', 'c18a870b-8382-4168-a3c8-fb48bb44b10c',
'c1ea5b19-479f-4e68-a247-4ccef6bb85bc', 'c272e3ae-b7de-45c6-a80b-1b4619949ad4', 'c2d00fbe-942f-418f-a3a1-1aff62c320f0', 'c3bb10bc-a13d-47b0-a473-c484ae41af0a',
'c41800b4-692b-477b-a369-aee75e5d4738', 'c4b4b025-7287-4aa0-aec3-fb8e1e7549b2', 'c4ce9695-54cd-4412-a7b8-5b120a92fc59', 'c63f6aff-a98a-466b-af7e-9853f5279862',
'c6911aa6-76e8-42f3-ad0b-e0e32380d9b1', 'c7145e68-511e-414d-ac5e-6439422860e7', 'c73f8edd-59bf-4469-aab4-82bf69097e74', 'c78a774a-164c-4ee7-a4f0-30c72efe1ce2',
'c7fd77e6-c89b-47a2-a112-4d5e824aee87', 'c8c56e72-9f23-4425-a1b5-546b696b623e', 'c9e1505f-0f27-46eb-a7cc-3fbd7305a5f1', 'ca62720f-8bfc-4ae8-a619-ef90509deb4e',
'cacbf88c-ad41-4c90-aab9-aa5ce926703f', 'caefce95-230a-4ac6-addc-9d962ccec56e', 'cbb0c57f-4694-4fbb-ac9d-33f993ab2010', 'ccda61d1-714e-4d9d-a0c1-f3d7d55b3b4b',
'cd026f0d-9972-47b8-ae8c-93022ce0e574', 'ce8a6fb8-1479-4b7e-ab6e-fa70457037ce', 'ce9ce8fb-4d87-4afd-ac69-16a534ba3133', 'cf9cc11a-d659-4a0e-a801-e106bae94bb3',
'cfa2cdf9-7606-4b7c-a153-a4b6c1e8e4c2', 'd020250e-c52d-4ebc-a7d1-684e036cd951', 'd03e1f5c-2b2e-4cd3-adad-aabd6d46231a', 'd060eafe-1b00-4d29-ad08-83f344598d28',
'd06a83af-a8a6-4f56-a1bb-e25caef3d852', 'd08505af-f3f9-4617-adfc-b18b76fd42b2', 'd1e1dd72-338a-45b8-a926-eefe6338a979', 'd206d988-605c-4855-af36-887320b19412',
'd21d1cea-a0d5-4ce4-abbd-e3fa7214cfe5', 'd246a81b-04e1-4c68-af78-3640b98bacfe', 'd2546de4-bfef-4d21-a156-edf1a4934873', 'd3f4ccf1-330c-4d2a-a0fb-72d65f15184e',
'd3fe4c27-8d3b-4553-acc9-2f8116179353', 'd429f999-a045-4205-ae74-03a7f0920fed', 'd4ae3e4f-459e-4935-a7cd-900fab5b7e43', 'd5c73a04-9e69-41b6-af7a-897c5d22ab7a',
'd6ec7f07-cb06-408a-a852-4f9cc0d93bcd', 'd7fbc83f-99b9-4423-a50c-0a77965aa3fa', 'd86c08d3-da52-4bdd-a88d-c5699f831d94', 'd8969507-8b0d-4501-acec-ac2d5e2eee0d',
'd8f6b2c0-7c11-411a-a202-52a88b0b4f8d', 'd9405b3c-fe2b-4a10-a5e9-46346d9f36ec', 'd9bf5e55-13a0-4d49-a196-6b3d2ffec947', 'da10848a-3ab6-4ec6-a0b3-ba7a02c370b7',
'da69a199-25f6-414e-a76c-88baee41d543', 'da6e2a98-3405-45ca-ad28-cbc88ba39534', 'db009e09-e1a1-45e4-a509-34ae64a837ea', 'dbf155fb-6d58-4631-a6d4-ea513cb1af3b',
'dbf64904-7cdd-4611-a8b6-fa272adb2c80', 'dc6be784-789a-4d1c-ad8c-e318f01130c0', 'dccae1fa-8d4c-43d7-ae54-cfe3cae115c8', 'dd31db5b-8ecb-4a86-ae0a-8fdc18716d66',
'dd550bee-dfb8-4e65-aa24-9131ff7543a0', 'dededbc5-364d-4009-a5fc-cb35e96df36f', 'dee7f195-6218-46be-a7af-fee67b8ea9eb', 'df042225-e05d-4a3d-a606-b5ab2e7846aa',
'df154cf7-5bf2-4124-a94d-5bdcf6f6902a', 'df444329-5538-4054-a9c5-b20ac0e835c2', 'e06ce10b-2576-4711-a781-ba4dba14923e', 'e0a8218f-df98-463d-a17e-70e909eaf062',
'e0a86965-38f2-491a-aac4-35d653439d55', 'e0ab6399-8676-4892-a920-a71a1f8647c3', 'e0b5cdda-9f04-40f7-a110-f4b3b72001ac', 'e0df1574-f5b9-47df-a642-25c329a10485',
'e0f73b97-6d16-44d7-ad5f-6f2b301ae284', 'e130e93c-1d40-4830-a020-d4e492f2b4e8', 'e145b610-258f-4e5e-aa4e-5cf0232e700f', 'e176c4d5-c766-47be-af07-168291a7b68a',
'e270a7b8-1881-4123-abe8-cb3982dd75b5', 'e2bd6742-5171-4330-ac71-3ba2d887d9d4', 'e2d9807d-cdd1-466d-a3d4-2af91da652b9', 'e3017c30-b100-46b8-a873-51dc84097d6e',
'e33a71dd-3cee-4ac6-a651-2cee593f7db3', 'e45857fd-f6c9-424e-aac5-1d221bf47429', 'e5193917-7c8a-4b36-a0d7-95bcc73a5362', 'e53e4179-9fe3-44b4-a151-d07e152ef09d',
'e544885c-98aa-48c3-af7e-c93bf015a6a2', 'e5c3cda3-657f-4f1c-abdc-b080cab1c442', 'e5de4994-1382-4799-a8b4-ccd70c333d77', 'e5eeb9e3-00d7-4e88-a1b1-70349aa8751d',
'e62894bd-4f91-49a2-a6f7-0d4a0bff377b', 'e6e97cf1-bffd-46a8-a721-dd169f332029', 'e7ded466-f8e4-444a-aff7-465ae17ac2c3', 'e7f32dd2-973a-41f8-a3e7-b2f21158693d',
'e8140d6e-282d-40ce-a64b-7eeec503fc02', 'e8144d46-37e5-4086-a423-6d7a581f6ed4', 'e83fe2b8-26fb-4333-a1e2-7235667c1c0b', 'e8e245c8-c8f7-46ba-a6a0-b504fcead4a2',
'e9398811-bcb7-4607-a09a-2f7d1705d657', 'ea3b18f0-c147-4be6-adf9-00f89ca7ef09', 'ea561537-7f86-4f77-af6d-80ed6f1da400', 'eade228b-51e9-4629-a8c9-c111c8b0ec91',
'ebb3ab45-6231-4619-acbb-37b193211c86', 'ebb8818f-a7f5-494d-a2ff-06150420da94', 'ec2ae732-0834-4468-ac37-8986b1772ac4', 'ec41069a-0d47-444d-ad7c-028d3a13f545',
'edddc26b-bbc4-42d4-a603-e6e8b0c419c4', 'edfad5c1-608f-4808-ab3d-f8a25c5a8894', 'ee3867e4-9682-4817-a1ad-fd278f8c9083', 'ee5d2851-5035-4507-ad3a-032733a521c4',
'eeba6cfd-3f00-47c2-a423-953aac1f34c6', 'ef7ebb89-db3b-4d29-a1c2-42516c20cf4a', 'ef81aa68-f5b1-452e-a8a4-5cc8eb17cf6d', 'f08a3286-53d1-4c7f-a05b-31d77eb8e14f',
'f0c6f5d1-732e-4260-af2d-7e427f65878d', 'f0f65d70-c63c-4a4f-a9f3-9feb61cdbe84', 'f0f8c599-991d-4876-a72c-998ae2fd8e33', 'f10dac26-becc-44cf-a5f4-212fafd9993a',
'f12facac-94ea-4a38-a632-9b94f6654356', 'f1b72583-eb8c-4ebe-aa15-4f1071631a25', 'f1c2dbd5-dcdb-4b9b-aac8-f7077f6bf50c', 'f1ecb49c-2033-40a4-a2d7-851466f3747d',
'f3273ebc-4c3e-4e49-a89b-a7c36bc223f8', 'f4daf157-5856-4909-af22-24779b09d299', 'f586ff02-b897-4aba-a1e6-f67e4257e78d', 'f5a13b36-de30-4111-a995-51d75efaafd6',
'f5eab141-8ba9-463f-aec6-6a5d0df95609', 'f6339167-467f-45b1-a8a6-453190e28988', 'f6676cce-bc29-4c6c-aa51-28023082bec1', 'f66cb159-b5f1-447c-a129-0ffa137fba71',
'f690294f-8648-4e20-a5e3-ee6048185967', 'f6b466e5-95a9-4876-a124-04d6781ef987', 'f6d8f2ed-f859-4f8a-a56f-a966ef5ce4a4', 'f6e07076-740c-4198-a25f-2ada0eb4c025',
'f6e071e7-1424-4103-a8f2-fd47b3a75bab', 'f763c103-dea8-46be-a945-6224964036cb', 'f767a08a-6e7a-4790-a466-9326ea0f5f48', 'f951e887-1083-4492-a315-f29c8ccab06d',
'f9b5b02f-5c7a-446f-abe4-968d18a6b0fc', 'fa0570cb-4789-44a0-a770-41a890de3e58', 'fa442c9d-0d24-4081-a99b-2b377b20205b', 'fa57df28-f493-444b-a875-021d9335a18b',
'fae93a60-f3dc-4c5a-a6fb-c4a0ed5e852e', 'fb071b47-1266-473c-abf5-d1c4c494c2df', 'fb2894c1-0c55-4a4b-a6ad-ff8dae934419', 'fb64ab5d-cd6d-4ea6-a7b7-12ee79ebc996',
'fb96b71d-1da3-4924-a9da-cc7aef626846', 'fbfaf933-48fd-477e-ab17-f72c03aa3c1a', 'fc0e042b-1862-478b-a9e8-6a1147dac244', 'fc87600b-1874-4f58-a886-9c6092547963',
'fd0b289f-74d1-4df0-a9af-c4ace94188ac', 'fddc8691-95cb-4691-ad47-99a343aed0c5', 'ff1319b7-3fac-4cc9-a5fd-88036ad5e96d', 'ff7f0292-15fd-4baa-a236-4dce5f23c14c',
'ffd8d5ac-5a85-4dc5-a144-081ddffc7bdc'
-- uids: fim
]::text[] $$;

-- ---------- a trigger ----------
create or replace function public.conferir_tecnica()
returns trigger language plpgsql as $$
declare
  v_old       public.registros;
  v_tinha     boolean := false;
  v_tem       boolean;
  v_total     integer;
begin
  if tg_op = 'UPDATE' then
    v_old := old;
  else
    -- No upsert (insert ... on conflict do update) do sync, esta
    -- trigger roda duas vezes: primeiro como insert, depois como
    -- update. Se a linha já existe, quem confere é a passagem do
    -- update, que sabe como ela estava. Assim a mesma linha não
    -- conta duas vezes e editar com a conta cheia passa.
    if exists (select 1 from public.registros where id = new.id) then
      return new;
    end if;
  end if;

  if new.tabela <> 'techniques' then
    if new.dados ? 'propria' then
      raise exception 'propria_fora_de_techniques: só técnica pode ser própria'
        using errcode = '23514';
    end if;
    if v_old.tabela = 'techniques' and public.tecnica_e_propria(v_old.dados) then
      raise exception 'tecnica_propria_fixa: a técnica criada não muda de tabela'
        using errcode = '23514';
    end if;
    return new;
  end if;

  v_tinha := v_old.id is not null and v_old.tabela = 'techniques'
             and public.tecnica_e_propria(v_old.dados);
  v_tem := public.tecnica_e_propria(new.dados);

  -- o propria não sai; na técnica apagada, o servidor o mantém
  if v_tinha and not v_tem then
    if new.deleted_at is null then
      raise exception 'tecnica_propria_fixa: a técnica criada continua sendo criada'
        using errcode = '23514';
    end if;
    new.dados := new.dados || jsonb_build_object('propria', 1);
    v_tem := true;
  end if;

  -- sem propria, só técnica do catálogo (a apagada fica de fora)
  if not v_tem and new.deleted_at is null
     and not coalesce(new.dados->>'uid', '') = any (public.uids_catalogo_tecnicas()) then
    raise exception 'tecnica_fora_do_catalogo: técnica criada precisa vir marcada como própria'
      using errcode = '23514';
  end if;

  if char_length(new.dados->>'nome') > public.nome_tecnica_max()
     and (new.dados->>'nome') is distinct from (v_old.dados->>'nome') then
    raise exception 'tecnica_nome_longo: o nome passa de % caracteres', public.nome_tecnica_max()
      using errcode = '23514';
  end if;
  if char_length(new.dados->>'detalhes') > public.detalhes_tecnica_max()
     and (new.dados->>'detalhes') is distinct from (v_old.dados->>'detalhes') then
    raise exception 'tecnica_detalhes_longo: o "como você faz" passa de % caracteres', public.detalhes_tecnica_max()
      using errcode = '23514';
  end if;

  -- vaga nova: só quando a linha vira própria agora
  if v_tem and not v_tinha then
    -- Uma fila por conta: dois envios ao mesmo tempo (dois celulares)
    -- esperam um pelo outro, e o segundo já vê a linha do primeiro.
    -- A trava solta sozinha no fim da transação.
    perform pg_advisory_xact_lock(hashtext('cota_tecnicas:' || new.user_id::text));
    select count(*) into v_total
      from public.registros
     where user_id = new.user_id
       and tabela = 'techniques'
       and public.tecnica_e_propria(dados)
       and id <> new.id;
    if v_total >= public.limite_tecnicas_proprias() then
      raise exception 'limite_tecnicas: a conta chegou a % técnicas criadas', public.limite_tecnicas_proprias()
        using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists registros_cota_tecnicas on public.registros;
create trigger registros_cota_tecnicas before insert or update on public.registros
  for each row execute function public.conferir_tecnica();

-- ---------- só as tabelas que o app sincroniza ----------
-- src/db/db.js (TABELAS_SYNC) + settings (src/lib/sync.js, TABELA_AJUSTES)
alter table public.registros drop constraint if exists registros_tabela_valida;
alter table public.registros add constraint registros_tabela_valida check (tabela in (
  'positions', 'categories', 'techniques', 'partners', 'sessions', 'rolls',
  'goals', 'reviews', 'gameplans', 'injuries', 'competitions',
  'attackPlans', 'gradings', 'milestones', 'media',
  'academies', 'professors', 'aulasVistas', 'quizRespostas', 'pontos',
  'recFeitas', 'videoEventos', 'foods', 'meals', 'dietPlans',
  'settings'
)) not valid;

-- ---------- apagar de vez: nunca a técnica própria ----------
drop policy if exists registros_delete on public.registros;
create policy registros_delete on public.registros for delete
  to authenticated using (
    (select auth.uid()) = user_id
    and not (tabela = 'techniques' and public.tecnica_e_propria(dados))
  );

-- ============================================================
-- CONFERÊNCIA ANTES DE RODAR (cole sozinha, só lê)
-- Técnicas vivas sem propria e com uid fora do catálogo: cada uma
-- seria recusada na próxima edição. Tem que dar zero (ou só contas
-- que ainda vão abrir o app novo).
--
-- select user_id, count(*) from public.registros
--  where tabela = 'techniques' and deleted_at is null
--    and not public.tecnica_e_propria(dados)
--    and not coalesce(dados->>'uid', '') = any (public.uids_catalogo_tecnicas())
--  group by user_id order by 2 desc;
--
-- (as funções acima precisam existir: rode primeiro só a parte das
-- funções, ou troque public.uids_catalogo_tecnicas() pela lista.)
-- ============================================================
