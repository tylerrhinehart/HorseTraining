import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, test, expect } from 'vitest';
import HorseFinish from './HorseFinish';
const fixtures = vi.hoisted(() => ({ horse: { id:'horse-1', name:'Synthetic horse', status:'in_training', training_type:'sale_horse', arrival_date:null }, status:vi.fn(async()=>{}) }));
vi.mock('../supabase/useQuery',()=>({useQuery:(key:string[])=>({data:key[0]==='horse'?fixtures.horse:key[0]==='sessions'?[]:null,loading:false,error:null,refresh:vi.fn()})}));
vi.mock('../supabase/queries',()=>({getHorse:vi.fn(),getTrifectaForHorse:vi.fn(),listSessionsForHorse:vi.fn(),setHorseStatus:fixtures.status}));
vi.mock('../components/Toast',()=>({useToast:()=>({success:vi.fn(),error:vi.fn()})}));
vi.mock('../components/TrifectaEvaluation',()=>({default:()=>null}));
test('successful completion stays complete while the horse cache still holds the previous status',async()=>{
 render(<MemoryRouter initialEntries={['/horses/horse-1/finish?step=2']}><Routes><Route path='/horses/:id/finish' element={<HorseFinish/>}/></Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Mark training complete'}));
 await waitFor(()=>expect(screen.getByRole('heading',{name:'Training complete'})).toBeInTheDocument());
 expect(fixtures.status).toHaveBeenCalledWith('horse-1','complete');
 expect(fixtures.horse.status).toBe('in_training');
});
