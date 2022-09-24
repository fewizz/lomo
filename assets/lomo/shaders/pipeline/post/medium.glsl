#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/pipeline/post/shadow.glsl
#include lomo:shaders/pipeline/post/sky.glsl

float linear_noise3(vec3 pos) {
	pos = abs(pos);
	uvec3 uc = uvec3(pos + vec3(0.5));

	float ruu = hash13(uc + uvec3( 0,  0, 0));
	float rdu = hash13(uc + uvec3( 0, -1, 0));
	float luu = hash13(uc + uvec3(-1,  0, 0));
	float ldu = hash13(uc + uvec3(-1, -1, 0));
	
	float rud = hash13(uc + uvec3( 0,  0, -1));
	float rdd = hash13(uc + uvec3( 0, -1, -1));
	float lud = hash13(uc + uvec3(-1,  0, -1));
	float ldd = hash13(uc + uvec3(-1, -1, -1));
	
	vec3 c = vec3(uc) - vec3(0.5);
	vec3 a = pos - c;
	
	return mix(
		mix(mix(ldd, lud, a.y), mix(rdd, rud, a.y), a.x),
		mix(mix(ldu, luu, a.y), mix(rdu, ruu, a.y), a.x),
		a.z
	);
}

float clouds_noise(vec3 c) {
	return
	max(linear_noise3(c / 16.0) - 0.5, 0.0) * (1.0 / (1.0 - 0.5)) *
	    linear_noise3(c / 8.0);// *
	   // linear_noise3(c / 4.0);
}

vec3 clouds(vec3 light, vec3 o, vec3 dir, float dist, float sky_light) {
	const float height = 128.0;
	vec3 sd = sun_dir();
	vec3 sun = 0.1 * sky(sd, true);
	vec3 v = vec3(0.0);

	float dist_to_begin = height - o.y / dir.y;
	dist_to_begin *= sign(dir.y);
	dist_to_begin = max(0.0, dist_to_begin);
	o += dir * dist_to_begin;
	dist -= dist_to_begin;

	const int steps = 6;
	const float max_distance = 256.0;
	dist = min(dist, max_distance);
	float stp = dist / float(steps);
	for(int i = 0; i < steps; ++i) {
		vec3 c = o + vec3(10000.0) + vec3(frx_renderSeconds, 0, 0) * 8.0;
		c /= 6.0;
		float v0 = pow(clouds_noise(c), 0.5);
		v0 *= smoothstep(height, height + 64.0, o.y);

		float v1 = pow(clouds_noise(c + sd * max_distance / float(steps)), 0.5);
		v1 *= smoothstep(height, height + 64.0, o.y);

		v += (v0 + v1 * 10.0) * stp;
		o += dir * stp;
	}
	v *= max(0.0, sky_light - 0.05);
	light += vec3(v / 500.0);
	return light;
}

vec3 fog(vec3 light, vec3 o, vec3 dir, float dist, float sky_light) {
	const float height = 78.0;
	vec3 sd = sun_dir();
	vec3 sun = 0.15 * sky(sd, true);
	vec3 v = vec3(0.0);

	const int steps = 8;
	float max_distance = frx_viewDistance * 4.0;
	dist = min(dist, max_distance);
	float stp = dist / float(steps + 1);
	o += dir * stp / 2.0;

	for(int i = 0; i < steps; ++i) {
		float v0 = exp(-((o.y + 100.0) / 80.0));
		//v0 *= sun_light_at_world_pos(o - frx_cameraPos);
		v += v0 * stp;
		o += dir * stp;
	}
	vec3 light0 = light;
	light = mix(
		light,
		mix(
			vec3(1.0, 2.0, 6.0) * length(sun) / 200.0 + sun / 100.0,
			light,
			exp(-v / frx_viewDistance * mix(1.0, 30.0, frx_smoothedRainGradient))
		),
		pow(max(0.0, sky_light - 0.2) * 1.2, 8.0)
	);

	return light;
}

vec3 medium(vec3 light, vec3 from, vec3 to, float sky_light) {
	vec4 fw0 = frx_inverseViewMatrix * vec4(from, 1.0);
	vec3 fw = fw0.xyz / fw0.w;
	vec3 f = fw + frx_cameraPos;

	vec4 tw0 = frx_inverseViewMatrix * vec4(to, 1.0);
	vec3 tw = tw0.xyz / tw0.w;
	vec3 t = tw + frx_cameraPos;

	float dist = distance(from, to);
	vec3 dir = (tw - fw) / dist;

	if(frx_worldHasSkylight == 1) {
		//light = clouds(light, f, dir, dist, sky_light);
		//light = fog(light, f, dir, dist, sky_light);
	}

	//float fog_dist = dist;
	//float fog_dist_to_begin = 128.0 - o.y / -dir.y;
	//fog_dist_to_begin *= sign(dir.y);
	//fog_dist_to_begin = max(0.0, fog_dist_to_begin);

	//}
	//light *= exp(-dist / 1000.0);
	//light += (1.0 - exp(-dist / 1000.0)) * sun / 1000.0;

	return light;
}