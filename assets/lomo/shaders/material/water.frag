#include frex:shaders/api/fragment.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/lib/noise/noise4d.glsl
#include frex:shaders/lib/noise/noise3d.glsl

/* lomo:material/water.glsl */

void frx_materialFragment() {
	#ifdef PBR_ENABLED
	frx_fragColor = vec4(vec3(1.0), 0.0);//mix(frx_vertexColor, vec4(1, 1, 1, 0.0), 0.8);

	frx_fragNormal = normalize(vec3(
		snoise(
			vec3(frx_cameraPos + frx_vertex.xyz) / 4.0 + vec3(frx_renderSeconds, frx_renderSeconds * 0.2, frx_renderSeconds)
		) / 64.0,
		snoise(
			vec4((frx_cameraPos + frx_vertex.xyz + 16) / 4.0, frx_renderSeconds)
		) / 64.0,
		1.0
	));
	frx_fragRoughness = 0.0;
	frx_fragReflectance = 0.02;

	#endif
}