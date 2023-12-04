#include frex:shaders/api/fragment.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/lib/noise/noise4d.glsl
#include frex:shaders/lib/noise/noise3d.glsl

void frx_materialFragment() {
	#ifdef PBR_ENABLED

	frx_fragNormal = normalize(vec3(
		snoise(
			vec4(frx_cameraPos + frx_vertex.xyz, frx_renderSeconds)// / 2.0 + vec3(frx_renderSeconds, frx_renderSeconds * 0.2, frx_renderSeconds)
		) / 32.0,
		snoise(
			vec4((frx_cameraPos + frx_vertex.xyz + 16), frx_renderSeconds)// / 2.0 + frx_renderSeconds)
		) / 32.0,
		1.0
	));

	frx_fragRoughness = 0.0;
	frx_fragReflectance = 1.0;

	#endif
}