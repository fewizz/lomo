#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/fog.glsl

#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/pipeline/post/shadow.glsl

vec3 fog(vec3 light, vec3 o, vec3 dir, float max_dist, float sky_light, samplerCube sky) {
	float vsun = 0.0;

	uint steps = 32u;//int(frx_viewDistance / 32);
	float wd = frx_viewDistance * mix(1.0, 0.2, frx_smoothedRainGradient);
	max_dist = min(max_dist, wd * 1.5);

	float stp = max_dist / float(steps + 1u);
	float prev_dist = 0.0;
	vec3 sh_dir = mat3(frx_shadowViewMatrix) * dir;
	vec4 sh_pos_begin0 = frx_shadowViewMatrix * vec4(o - frx_cameraPos, 1.0);
	vec3 sh_pos_begin = sh_pos_begin0.xyz / sh_pos_begin0.w;

	for(uint i = 0u; i < steps; ++i) {
		float d = (float(i) + 0.5) * stp;
		float offset = hash13(
			uvec3(uvec2(gl_FragCoord.xy), i + uint(frx_renderFrames) * (1024u * 1024u))
		) - 0.5;
		d += offset * stp;

		vec3 o0 = o + dir * d;
		float v0 = exp(-(max(0.0, (o0.y - 64.0)) / 32.0));

		float delta = d - prev_dist;
		v0 *= delta;

		vsun += v0
			#ifdef MEDIUM_WITH_SUN
			* sun_light_at_shadow_pos(sh_pos_begin + sh_dir * d);
			#else
			;
			#endif
		prev_dist = d;
	}
	vsun /= wd;

	vec3 sk = texture(sky, dir, 7.0).rgb;
	//vec3 sn = texture(sky, sun_dir(), 7.0).rgb;

	light = mix(
		light,
		sk * frx_fogColor.rgb * frx_fogColor.a,// + sn * (dot(sun_dir(), dir) + 1.0) * 0.000001,
		vec3(min(pow(vsun, mix(2.5, 1.0, frx_smoothedRainGradient)), 1.0))
	);

	return light;
}

vec3 medium(vec3 light, vec3 from, vec3 to, vec3 dir, float sky_light, samplerCube sky) {
	vec4 fw0 = frx_inverseViewMatrix * vec4(from, 1.0);
	vec3 fw = fw0.xyz / fw0.w;
	vec3 f = fw + frx_cameraPos;

	vec4 tw0 = frx_inverseViewMatrix * vec4(to, 1.0);
	vec3 tw = tw0.xyz / tw0.w;
	vec3 t = tw + frx_cameraPos;

	float dist = distance(from, to);
	dir = mat3(frx_inverseViewMatrix) * dir;

	if(frx_worldHasSkylight == 1) {
		//light = fog(light, f, dir, dist, sky_light, sky);
	}

	return light;
}