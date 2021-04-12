#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/pipeline/lomo_frag_outputs.glsl

/* lomo:material/reflection.frag */

void frx_startFragment(inout frx_FragmentData fragData) {
	//fragData.emissivity = -fragData.emissivity;
	fragColor[1].a = 1;
}

