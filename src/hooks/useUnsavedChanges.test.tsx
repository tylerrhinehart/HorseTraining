import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import useUnsavedChanges from './useUnsavedChanges';
afterEach(cleanup);
function Editor(){const {dialog}=useUnsavedChanges(true);return <>{dialog}<Link to='/other'>Horses</Link></>;}
it('blocks internal navigation and browser Back until explicit discard',async()=>{
 const router=createMemoryRouter([{path:'/editor',element:<Editor/>},{path:'/other',element:<h1>Roster</h1>}],{initialEntries:['/other','/editor']});render(<RouterProvider router={router}/>);
 fireEvent.click(screen.getByRole('link',{name:'Horses'})); expect(await screen.findByRole('dialog')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Keep editing'})); expect(router.state.location.pathname).toBe('/editor');
 await act(async()=>{await router.navigate(-1);}); expect(await screen.findByRole('dialog')).toBeVisible(); fireEvent.click(screen.getByRole('button',{name:'Leave without saving'}));expect(await screen.findByRole('heading',{name:'Roster'})).toBeVisible();
});
