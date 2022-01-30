#include frex:shaders/api/fragment.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/lib/noise/noise4d.glsl
#include lomo:shaders/pipeline/lomo_frag_header.glsl

/* lomo:material/water.glsl */

float lomo_water_h(vec3 pos) {
	float t = frx_renderSeconds;
	return snoise(
		vec4(pos/4.0, t)
	) / 64.0;
}

void frx_materialFragment() {
	vec3 pos = frx_vertex.xyz + frx_modelToWorld.xyz;

	vec3 norm = normalize(frx_vertexNormal);
	vec3 dir = vec3(norm.z, norm.x, norm.y);

	vec3 orth0 = normalize(cross(-dir, norm));
	vec3 orth1 = cross(orth0, norm);

	vec3 orig = pos + norm * lomo_water_h(pos);
	vec3 pos0 = pos + orth0 * 0.01;
	vec3 pos1 = pos + orth1 * 0.01;

	pos0 += norm * lomo_water_h(pos0);
	pos1 += norm * lomo_water_h(pos1);

	frag_normal = normalize(cross(pos0 - orig, pos1 - orig));

	frx_fragColor = frx_vertexColor*0.25 + vec4(0, 1, 1, 0)*0.75;

	reflectivity = 1.0;
}