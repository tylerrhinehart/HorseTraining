// Never connects beyond loopback; creates a NEW database and never drops one.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const port=process.argv[2]??'56432';if(!/^\d{4,5}$/.test(port)||Number(port)>65535)throw new Error('Invalid loopback test port');
const name=process.argv[3]??'tqa_legacy_test';if(!/^tqa_legacy_test(?:_[a-z0-9]+)?$/.test(name))throw new Error('Use a new legacy fixture database');
const db=`postgresql://postgres@127.0.0.1:${port}/${name}`;
execFileSync('createdb',['-h','127.0.0.1','-p',port,'-U','postgres',name]);
const sql=body=>execFileSync('psql',[db,'-Xq','-v','ON_ERROR_STOP=1'],{input:body,encoding:'utf8',stdio:['pipe','pipe','pipe']});
try {
 for(const file of ['tests/database/bootstrap.sql','tests/database/fixtures/legacy-schema.sql','tests/database/fixtures/legacy-records.sql'])sql(fs.readFileSync(file,'utf8'));
 const upgrade=execFileSync(process.execPath,['scripts/build-facility-upgrade.mjs'],{encoding:'utf8'});
 sql("create table public.tqas(id uuid primary key); insert into public.tqas values('70000000-0000-0000-0000-000000000001');");
 let needsMapping=false;try{sql(upgrade);}catch(e){needsMapping=String(e.stderr).includes('Nonempty obsolete tqas table');}
 if(!needsMapping)throw new Error('Unknown legacy records were not protected');
 sql("do $$ begin if (select count(*) from public.horses)<>2 or to_regnamespace('tqa_legacy') is not null then raise exception 'Rejected migration changed data'; end if; end $$; delete from public.tqas;");
 sql(upgrade);console.log(sql(fs.readFileSync('tests/database/legacy-transition.sql','utf8')));
 // A second legacy upgrade must fail before modifying the now facility-aware DB.
 let rejected=false;try{sql(upgrade);}catch(e){rejected=String(e.stderr).includes('Already facility-aware');}if(!rejected)throw new Error('Repeated upgrade did not fail safely');
 console.log('PASS: repeated legacy upgrade rejected without resetting anything');
} catch(e) {process.stderr.write(e.stderr?.toString()??e.message);process.exitCode=1;}
