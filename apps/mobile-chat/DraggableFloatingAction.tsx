import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,Keyboard,PanResponder,useWindowDimensions} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {constrainFloatingPoint} from './floatingPosition';
export default function DraggableFloatingAction({children,storageKey}:{children:React.ReactNode;storageKey:string}) {
 const {width,height}=useWindowDimensions(),insets=useSafeAreaInsets();
 const [size,setSize]=useState({width:Math.min(172,width-32),height:48}),[keyboard,setKeyboard]=useState(false);
 const bounds=useRef({width,height,top:insets.top,bottom:insets.bottom});bounds.current={width,height,top:insets.top,bottom:insets.bottom};
 const measured=useRef(size);measured.current=size;
 const initial=constrainFloatingPoint(null,bounds.current,size),point=useRef(initial),origin=useRef(initial),moved=useRef(false);
 const pan=useRef(new Animated.ValueXY(initial)).current;
 const clamp=(value:any,snap=false)=>constrainFloatingPoint(value,bounds.current,measured.current,snap);
 useEffect(()=>{let alive=true;void AsyncStorage.getItem(storageKey).then(raw=>{if(!alive||moved.current)return;let saved=null;try{saved=raw?JSON.parse(raw):null;}catch{}const next=clamp(saved,true);point.current=next;pan.setValue(next);}).catch(()=>{});return()=>{alive=false;};},[storageKey,pan]);
 useEffect(()=>{const next=clamp(point.current,true);point.current=next;pan.setValue(next);},[width,height,insets.top,insets.bottom,size.width,size.height,pan]);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));return()=>{show.remove();hide.remove();};},[]);
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>false,
  onMoveShouldSetPanResponder:(_,g)=>Math.hypot(g.dx,g.dy)>6,
  onMoveShouldSetPanResponderCapture:(_,g)=>Math.hypot(g.dx,g.dy)>6,
  onPanResponderGrant:()=>{moved.current=true;origin.current=point.current;},
  onPanResponderMove:(_,g)=>{const next=clamp({x:origin.current.x+g.dx,y:origin.current.y+g.dy});point.current=next;pan.setValue(next);},
  onPanResponderRelease:()=>{const next=clamp(point.current,true);point.current=next;pan.setValue(next);void AsyncStorage.setItem(storageKey,JSON.stringify(next)).catch(()=>{});},
  onPanResponderTerminate:()=>{const next=clamp(point.current,true);point.current=next;pan.setValue(next);},
  onPanResponderTerminationRequest:()=>false
 }),[pan,storageKey]);
 if(keyboard)return null;
 return <Animated.View pointerEvents="box-none" {...responder.panHandlers} onLayout={e=>{const next=e.nativeEvent.layout;if(Math.abs(next.height-size.height)>1||Math.abs(next.width-size.width)>1)setSize({width:next.width,height:next.height});}} style={{position:'absolute',left:0,top:0,width:Math.min(172,width-32),zIndex:1000,transform:pan.getTranslateTransform()}}>{children}</Animated.View>;
}
