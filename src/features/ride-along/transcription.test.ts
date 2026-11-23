// @vitest-environment node
import {expect,it,vi} from "vitest";
import {TRANSCRIPTION_MODEL,transcribeClip} from "../../../supabase/functions/transcribe-ride-turn/transcription";
it.each(["webm","mp4","ogg","wav"])("uses OpenRouter multipart transcription for %s with no draft identifiers",async extension=>{
 const key="synthetic-openrouter-key", signal=new AbortController().signal;
 const clip=new Blob(["synthetic clip"],{type:`audio/${extension}`});
 const request=vi.fn(async()=>Response.json({text:" minus two "})) as unknown as typeof fetch;
 expect(await transcribeClip(clip,extension,key,signal,request)).toBe(" minus two ");
 const [url,options]=vi.mocked(request).mock.calls[0];
 expect(url).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
 expect(options).toMatchObject({method:"POST",signal,headers:{authorization:`Bearer ${key}`}});
 const form=options!.body as FormData;
 expect([...form.keys()].sort()).toEqual(["file","model","response_format"]);
 expect(form.get("model")).toBe(TRANSCRIPTION_MODEL);expect(TRANSCRIPTION_MODEL).toBe("openai/gpt-transcribe");
 expect(form.get("response_format")).toBe("json");
 const file=form.get("file") as File;expect(file.name).toBe(`clip.${extension}`);expect(await file.text()).toBe("synthetic clip");
});
it.each([401,429,500,503])("fails closed on OpenRouter HTTP %s without direct-provider fallback",async status=>{
 const request=vi.fn(async()=>new Response("sensitive upstream detail",{status})) as unknown as typeof fetch;
 await expect(transcribeClip(new Blob(["synthetic"]),"webm","test",new AbortController().signal,request)).rejects.toThrow("Transcription unavailable");
 expect(request).toHaveBeenCalledTimes(1);
});
it.each([{text:3},{text:""},{text:"   "},{error:{message:"private"}}])("rejects malformed transcript %j",async body=>{
 const request=vi.fn(async()=>Response.json(body)) as unknown as typeof fetch;
 await expect(transcribeClip(new Blob(["synthetic"]),"webm","test",new AbortController().signal,request)).rejects.toThrow("Invalid transcription response");
});
it("never calls a provider without the shared server key",async()=>{
 const request=vi.fn() as unknown as typeof fetch;
 await expect(transcribeClip(new Blob(["synthetic"]),"webm","",new AbortController().signal,request)).rejects.toThrow("OpenRouter not configured");
 expect(request).not.toHaveBeenCalled();
});
