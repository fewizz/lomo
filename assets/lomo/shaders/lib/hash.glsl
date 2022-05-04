/* lomo:lib/hash.glsl */

// https://www.shadertoy.com/view/XlXcW4 , slightly modified
const uint k = 1103515245U;
vec2 hash22(uvec2 x ) {
	x = ((x>>8U)^x.yx)*k;
	x = ((x>>8U)^x.yx)*k;
	x = ((x>>8U)^x.yx)*k;
	
	return vec2(x)*(1.0/float(0xffffffffU));
}

vec2 hash23(uvec3 x) {
	x = ((x>>8U)^x.yzx)*k;
	x = ((x>>8U)^x.yzx)*k;
	x = ((x>>8U)^x.yzx)*k;
	
	return vec2(x.xy)*(1.0/float(0xffffffffU));
}

vec2 hash24(uvec4 v) {
	v = v * 1664525u + 1013904223u;
	v.x += v.y*v.w;
	v.y += v.z*v.x;
	v.z += v.x*v.y;
	v.w += v.y*v.z;
	v ^= v >> 16u;
	v.x += v.y*v.w;
	v.y += v.z*v.x;
	v.z += v.x*v.y;
	v.w += v.y*v.z;
	return v.yw * (1.0/float(0xffffffffU));
}

float hash13(uvec3 x) {
	return hash23(x).x;
}

float hash14(uvec4 x) {
	return hash24(x).x;
}