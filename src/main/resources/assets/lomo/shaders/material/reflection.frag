#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/pipeline/lomo_frag_outputs.glsl

/* lomo:material/reflection.frag */

// That's very hacky, not sure how to implement that properly
void frx_startFragment(inout frx_FragmentData fragData) {
	fragColor[1].a = 1;
}

