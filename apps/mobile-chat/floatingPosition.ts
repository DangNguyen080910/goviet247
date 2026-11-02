export type FloatingPoint={x:number;y:number};
export function constrainFloatingPoint(value:Partial<FloatingPoint>|null,bounds:{width:number;height:number;top:number;bottom:number},size:{width:number;height:number},snap=false):FloatingPoint {
 const minX=16,maxX=Math.max(minX,bounds.width-size.width-16);
 const minY=Math.min(bounds.top+72,Math.max(bounds.top+8,bounds.height-bounds.bottom-size.height-8));
 const maxY=Math.max(minY,bounds.height-bounds.bottom-8-size.height);
 let x=Number.isFinite(value?.x)?value!.x!:maxX,y=Number.isFinite(value?.y)?value!.y!:Math.max(minY,bounds.height-bounds.bottom-88-size.height);
 x=Math.min(maxX,Math.max(minX,x));y=Math.min(maxY,Math.max(minY,y));
 if(snap)x=x+size.width/2<bounds.width/2?minX:maxX;
 return {x,y};
}
