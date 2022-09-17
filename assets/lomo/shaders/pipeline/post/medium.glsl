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
	return max(linear_noise3(c / 16.0) - 0.5, 0.0) * 64.0 *
		linear_noise3(c / 8.0) * 16.0 *
		linear_noise3(c / 4.0) * 4.0;
}

vec3 medium(vec3 light, vec3 from, vec3 to) {
	vec4 fw0 = frx_inverseViewMatrix * vec4(from, 1.0);
	vec3 fw = fw0.xyz / fw0.w;
	vec3 f = fw + frx_cameraPos;

	vec4 tw0 = frx_inverseViewMatrix * vec4(to, 1.0);
	vec3 tw = tw0.xyz / tw0.w;
	vec3 t = tw + frx_cameraPos;

	float dist = distance(tw, fw);
	vec3 dir = (tw - fw) / dist;

	const float height = 200.0;
	if(f.y >= height || (f.y < height && dir.y > 0)) {
		vec3 sd = sun_dir();
		vec3 sun = 0.15 * sky(sd, true);
		vec3 v = vec3(0.0);
		float depth = 0.0;
		vec3 o = f;

		if(o.y < height && dir.y > 0) {
			o += dir * (height - o.y) / dir.y;
			dist -= (height - o.y) / dir.y;
		}

		const int steps = 8;
		dist = min(dist, 128.0 * steps);
		float stp = dist / float(steps);

		for(int i = 0; i < steps; ++i) {
			vec3 c = o + vec3(frx_renderSeconds, 0, 0) * 64.0 + vec3(10000.0);
			c /= 16.0;
			float v0 = clouds_noise(c);
			v0 *= smoothstep(height, height + 64.0, o.y);
			v0 *= sun_light_at_world_pos(o);
			depth += v0;

			v += v0 * sun / 20000.0;
			o += dir * stp;
		}
		//light *= exp(-depth / 100.0);
		//light += v * vec3(0.3, 0.5, 1.0);
		//light += sun * s * v / 10.0;
	}

	return light;
}