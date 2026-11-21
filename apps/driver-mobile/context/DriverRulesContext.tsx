import { mergeDriverRulesStatus } from '../../api/src/shared/driverRulesState.js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { driverRulesRequest, type RulesStatus } from '../services/driverRulesApi';
import { getDriverToken } from '../services/storage';
const empty:RulesStatus={release:null,needsAcceptance:false,acceptance:null};
const Context=createContext<{status:RulesStatus;refresh:()=>Promise<void>;sync:(value:RulesStatus)=>void}>({status:empty,refresh:async()=>{},sync:()=>{}});
export function DriverRulesProvider({children}:{children:ReactNode}) {
  const [status,setStatus]=useState<RulesStatus>(empty);
  const epoch=useRef(0),alive=useRef(true),session=useRef<string|null>(null);
  const sync=useCallback((value:RulesStatus)=>{epoch.current++;setStatus(old=>mergeDriverRulesStatus(old,value));},[]);
  const refresh=useCallback(async()=>{
    const request=++epoch.current;
    try {
      const token=await getDriverToken();
      if(!token){session.current=null;if(alive.current&&request===epoch.current)setStatus(empty);return;}
      if(session.current!==token){session.current=token;if(alive.current)setStatus(empty);}
      const value=await driverRulesRequest<RulesStatus>('/status');
      if(alive.current&&request===epoch.current&&token===await getDriverToken())setStatus(old=>mergeDriverRulesStatus(old,value));
    } catch { /* Keep the last known badge on transient failures; never log the driver out. */ }
  },[]);
  useEffect(()=>{
    alive.current=true;void refresh();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
    const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},60000);
    return()=>{alive.current=false;epoch.current++;subscription.remove();clearInterval(timer);};
  },[refresh]);
  return <Context.Provider value={{status,refresh,sync}}>{children}</Context.Provider>;
}
export const useDriverRules=()=>useContext(Context);
