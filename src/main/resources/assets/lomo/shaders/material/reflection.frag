#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl
#include lomo:shaders/pipeline/lomo_frag_header.glsl

// lomo:material/reflection.frag

void frx_startFragment(inout frx_FragmentData fragData) {
	reflectivity = 1.0;
}