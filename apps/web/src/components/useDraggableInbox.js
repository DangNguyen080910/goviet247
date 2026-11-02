import {useEffect,useRef,useState} from 'react';
const STORAGE_KEY='goviet247-admin-inbox-position';
export default function useDraggableInbox(enabled, storageKey = STORAGE_KEY) {
 const [node,setNode]=useState(null),[position,setPosition]=useState(null);
 const point=useRef(null),gesture=useRef(null),suppress=useRef(false);
 function clamp(value,snap=false) {
  const v=window.visualViewport,left=v?.offsetLeft||0,top=v?.offsetTop||0,w=v?.width||window.innerWidth,h=v?.height||window.innerHeight;
  const box=node?.getBoundingClientRect(),width=box?.width||172,height=box?.height||48;
  const minX=left+16,maxX=Math.max(minX,left+w-width-16),minY=top+Math.min(88,Math.max(8,h-height-16)),maxY=Math.max(minY,top+h-height-16);
  let x=Number.isFinite(value?.x)?value.x:maxX,y=Number.isFinite(value?.y)?value.y:Math.max(minY,top+h-height-100);
  x=Math.min(maxX,Math.max(minX,x));y=Math.min(maxY,Math.max(minY,y));
  if(snap)x=x+width/2<left+w/2?minX:maxX;
  return {x,y};
 }
 function move(value){point.current=value;setPosition(value);}
 useEffect(()=>{
  if(!enabled||!node)return;
  let saved=point.current;
  if(!saved)try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
  move(clamp(saved));
  const resize=()=>move(clamp(point.current,true));
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(node);
  window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
  return()=>{observer?.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);};
 },[enabled,node,storageKey]);
 return {
  ref:setNode,
  style:position?{position:'fixed',left:position.x,top:position.y,zIndex:1400}:{position:'fixed',bottom:100,right:20,zIndex:1400},
  startDrag(event){if(!event.isPrimary||event.button!==0)return;suppress.current=false;gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,origin:point.current||clamp(null),moved:false};event.currentTarget.setPointerCapture(event.pointerId);},
  moveDrag(event){const g=gesture.current;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;if(!g.moved&&Math.hypot(dx,dy)<6)return;g.moved=true;suppress.current=true;move(clamp({x:g.origin.x+dx,y:g.origin.y+dy}));},
  finish(event){const g=gesture.current;if(!g||g.id!==event.pointerId)return;gesture.current=null;if(g.moved){const next=clamp(point.current,true);move(next);try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{}}if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);},
  consumeClick(event){const blocked=suppress.current&&event.detail!==0;suppress.current=false;if(blocked){event.preventDefault();event.stopPropagation();}return blocked;}
 };
}
