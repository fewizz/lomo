#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl

/* lomo:material/reflection.frag */

void frx_startFragment(inout frx_FragmentData fragData) {
	//fragData.emissivity = -fragData.emissivity;
	gl_FragData[1].a = 1;
}

