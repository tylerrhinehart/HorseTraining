// Separate psql connections, synthetic fixture data, loopback-only disposable DB.
// Requires acceptance.sql. A port argument supports an independent local container.
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const port=process.argv[2]??'56432';
if(!/^\d{4,5}$/.test(port)||Number(port)>65535)throw new Error('Use a local disposable PostgreSQL port');
const db=`postgresql://postgres@127.0.0.1:${port}/tqa_test`;
const uid='00000000-0000-0000-0000-000000000001';
function query(sql){
 const output=execFileSync('psql',[db,'-XAtq','-v','ON_ERROR_STOP=1'],{input:`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);\n${sql}`,encoding:'utf8'}).trim().split('\n');
 return JSON.parse(output.at(-1));
}
const horse=randomUUID(),turn=randomUUID();
const initial=query(`insert into public.horses(id,facility_id,name,training_type,current_phase_id)
 select '${horse}',p.facility_id,'Synthetic guided connection test','foundation',p.id from public.phases p join public.facilities f on f.id=p.facility_id where f.name='Fixture Facility A' and p.program='foundation' and p.code='phase_1';
 select public.create_ride_draft(h.facility_id,h.id,h.current_phase_id,'${randomUUID()}') from public.horses h where h.id='${horse}';`);
// Only this isolated fixture's flag is set; no hosted configuration is accessed.
execFileSync('psql',[db,'-XAtq','-v','ON_ERROR_STOP=1'],{input:`update public.facilities set voice_enabled=true where id='${initial.facility_id}';`,encoding:'utf8'});
const question=query(`select to_jsonb(id) from public.questions where phase_id='${initial.phase_id}' and axis='foundation' order by position,id limit 1;`);
query(`select public.bind_guided_turn('${initial.id}',1,'${question}','${turn}');`);
const ratings=JSON.stringify([{question_id:question,score:-1,comment:'synthetic'}]);
const confirm=`select public.confirm_guided_score('${initial.id}',1,'${turn}','${question}',-1::smallint,'Synthetic notes','{}','${ratings}',null,'Synthetic trainer',null,'[]');`;
const saved=query(confirm);
const resumed=query(`select public.get_ride_draft('${initial.id}');`);
const retry=query(confirm);
if(saved.version!==2||resumed.guided_cursor!==1||retry.version!==2||retry.guided_cursor!==1||resumed.ratings[0].score!==-1||resumed.session_id!==null)throw new Error('Durable confirmation/resume/retry mismatch');
console.log('PASS: separate connections bind, confirm, resume signed score/cursor, exact retry without duplicate advancement; no ride finalized');
