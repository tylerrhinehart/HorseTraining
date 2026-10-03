import { fireEvent, render, screen, within, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
const mocks=vi.hoisted(()=>({update:vi.fn(),questionsError:null as Error|null}));
vi.mock('../supabase/queries',()=>({getSession:vi.fn(),getHorse:vi.fn(),listPhases:vi.fn(),listQuestionsForPhase:vi.fn(),deleteSession:vi.fn(),updateSession:mocks.update}));
vi.mock('../components/Toast',()=>({useToast:()=>({success:vi.fn(),error:vi.fn()})}));
const question={id:'q',phase_id:'p',axis:'foundation',position:0,text:'Ground Work',low_label:'Poor',high_label:'Excellent'};
const saved={id:'s',horse_id:'h',phase_id:'p',occurred_at:'2026-10-02T12:00:00Z',rider:'Wade',bit:'bit_2',notes:'Original',task_completions:[{job:'fence_work',phase:2},{job:'heading',phase:3}],ratings:[{question_id:'q',score:4,comment:null}]};
vi.mock('../supabase/useQuery',()=>({useQuery:(key:unknown[])=>({data:key?.[0]==='session'?saved:key?.[0]==='horse'?{name:'Pilot horse'}:key?.[0]==='phases'?[{id:'p',code:'performance_warmup',program:'sale_horse',scale:'five',name:'Warm-up'}]:mocks.questionsError?undefined:[question],loading:false,error:key?.[0]==='questions'?mocks.questionsError:null,refresh:vi.fn()})}));
import SessionDetail from './SessionDetail';
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.questionsError=null;});
const open=()=>render(<RouterProvider router={createMemoryRouter([{path:'/sessions/:id',element:<SessionDetail/>}],{initialEntries:['/sessions/s']})}/>);
it('review is read-only; editing a score preserves rider, bit, date and independent tasks',async()=>{
 open(); const group=screen.getByRole('group',{name:'Ground Work'}); expect(within(group).getByRole('button',{name:'Rate 5'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Edit ride'})); fireEvent.click(within(group).getByRole('button',{name:'Rate 5'}));
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await waitFor(()=>expect(mocks.update).toHaveBeenCalled());
 const patch=mocks.update.mock.calls[0][1]; expect(patch).toMatchObject({rider:'Wade',bit:'bit_2',notes:'Original',occurred_at:new Date(saved.occurred_at).toISOString(),task_completions:saved.task_completions}); expect(patch.ratings[0].score).toBe(5);
});
it('question loading errors cannot clear the saved rating set',()=>{
 mocks.questionsError=new Error('Score sheet unavailable'); open(); fireEvent.click(screen.getByRole('button',{name:'Edit ride'}));
 expect(screen.getByRole('alert')).toHaveTextContent('Score sheet unavailable'); expect(screen.getByRole('button',{name:'Save changes'})).toBeDisabled(); expect(mocks.update).not.toHaveBeenCalled();
});
