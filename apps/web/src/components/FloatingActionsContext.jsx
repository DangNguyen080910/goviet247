import { createContext, useContext, useMemo, useRef, useState } from 'react';

const FloatingActionsContext = createContext({dockTarget:null, setDockTarget:()=>{},dockDragRef:{current:null}});
export function FloatingActionsProvider({children}) {
  const [dockTarget, setDockTarget] = useState(null);
  const dockDragRef = useRef(null);
  const value = useMemo(()=>({dockTarget,setDockTarget,dockDragRef}),[dockTarget]);
  return <FloatingActionsContext.Provider value={value}>{children}</FloatingActionsContext.Provider>;
}
export const useFloatingActions = () => useContext(FloatingActionsContext);
