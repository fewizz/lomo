#include frex:shaders/api/fragment.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/lib/noise/noise4d.glsl

/* lomo:material/water.glsl */

void frx_materialFragment() {
	#ifdef PBR_ENABLED
	frx_fragColor = mix(frx_vertexColor, vec4(1, 1, 1, 0.0), 0.8);

	frx_fragNormal = normalize(vec3(
		snoise(
			vec4(frx_vertex.xyz / 4.0, frx_renderSeconds)
		) / 64.0,
		snoise(
			vec4((frx_vertex.xyz + 16)/4.0, frx_renderSeconds)
		) / 64.0,
		1.0
	));
	frx_fragRoughness = 0.0;
	#endif
}