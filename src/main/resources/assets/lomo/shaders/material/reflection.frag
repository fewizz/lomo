#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl

/* lomo:material/reflection.frag */

void frx_startFragment(inout frx_FragmentData fragData) {
	//fragData.emissivity = -fragData.emissivity;
	gl_FragData[2] = (vec4(fragData.vertexNormal, 1) + 1) / 2;
}

