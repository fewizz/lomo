#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl
#include lomo:shaders/pipeline/lomo_frag_header.glsl

/* lomo:material/reflection.frag */

void frx_materialFragment() {
	emissivity = 1.;
	//frx_fragNormal = frx_vertexNormal;
}