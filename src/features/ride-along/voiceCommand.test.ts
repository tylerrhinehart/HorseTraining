import { expect, it } from "vitest";
import {scoreReadback} from "./voiceCommand";
it.each([-3,-2,-1,0,1,2,3])("reads back the server-bound question and signed score %s",score=>{
 const text=scoreReadback({questionId:"q",label:"Current question",score,binding:{draft_id:"d",question_id:"q",version:1,turn_id:"t"}});
 expect(text).toContain("Current question"); expect(text).toContain(score<0?"minus":score>0?"plus":"zero"); expect(text).toContain("Confirm or discard");
});
