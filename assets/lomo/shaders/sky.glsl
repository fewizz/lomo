#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/lib/ray_sphere.glsl
#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/lib/linear.glsl

/* lomo:pipeline/post/sky.glsl */

vec3 sun_dir() {
	float t = frx_skyAngleRadians + PI / 2.0;
	return rotation(
		20.0 / 180.0 * PI,
		vec3(1.0, 0.0, 0.0)
	) * vec3(cos(t), sin(t), 0);
}

struct layer {
	float height;
	float scale_height;
};

float ray_layer_intersection(ray r, layer l) {
	sphere top_sphere = sphere(
		vec3(0.0, -l.height, 0.0), l.height + (l.scale_height * 1.5)
	);
	sphere bot_sphere = sphere(
		vec3(0.0, -l.height, 0.0), l.height - 20000.0
	);
	ray_sphere_intersection_result top = ray_sphere_intersection(r, top_sphere);
	ray_sphere_intersection_result bot = ray_sphere_intersection(r, bot_sphere);
	if(bot.success && bot.close >= 0.0) {
		return bot.close;
	}
	if(top.success) {
		return max(0.0, top.far) - max(0.0, top.close);
	}
	return 0.0;
}

const int steps = 6;

float od(vec3 po, vec3 dir, float dist, layer l) {
	float stp = dist / float(steps);
	po += dir * stp / 2.0;
	float result = 0;
	for(int i = 0; i < steps; ++i) {
		float dist = distance(po, vec3(0.0, -l.height, 0.0)) - l.height;
		result += exp(-dist/l.scale_height) * stp;
		po += dir * stp;
	}
	return result;
}

float henyey_greenstein_phase_function(float g, float cosa) {
	return 3.0*(1.0-g*g)/(2.0*(2.0+g*g)) * (1.0+cosa*cosa)/pow(1.0+g*g-2.0*g*cosa, 3.0/2.0);
}

float rayleigh_phase_function(float cosa) {
	return 3.0 / (16.0 * PI) * (1.0 + cosa * cosa);
}

vec3 sky(ray r, layer l, vec3 coeffs) {
	float dist = ray_layer_intersection(r, l);
	float stp = dist / float(steps);
	dist = stp / 2.0;
	vec3 result = vec3(0.0);
	for(int i = 0; i < steps; ++i) {
		ray r0 = ray(r.pos + r.dir * dist, sun_dir());
		sphere bot_sphere = sphere(
			vec3(0.0, -l.height, 0.0), l.height - 20000.0
		);
		ray_sphere_intersection_result bot = ray_sphere_intersection(r0, bot_sphere);

		if(!(bot.success && bot.close >= 0.0)) {
			float dist0 = ray_layer_intersection(r0, l);
			result +=
				exp(
					-coeffs * (
						od(r0.pos, sun_dir(), dist0, l) +
						od(r.pos, r.dir, dist, l)
					)
				) * stp;
		}
		dist += stp;
	}
	return result * coeffs;
}

const float earth_radius = 6000000.0;

vec3 overworld_sky(vec3 dir, float sun_mul) {
	vec3 eye_pos = frx_cameraPos;
	//eye_pos.y += 1000.0;
	eye_pos.x = 0.0; eye_pos.z = 0.0;
	ray eye = ray(eye_pos, dir);
	float a = dot(dir, sun_dir());
	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));
	vec3 color = sky(
		eye,
		layer(earth_radius, 8000.0),
		0.0015 / rgb
	) * 40.0 * rayleigh_phase_function(a) * vec3(0.5, 0.8, 1.0);
	vec3 m = sky(
		eye,
		layer(earth_radius, 1200.0),
		0.5 / rgb
	) * 3.0 * henyey_greenstein_phase_function(0.996, a) * vec3(1.0, 0.4, 0.4);

	m *= sun_mul;

	//vec3 s = (1.0 - smoothstep(0.0, PI / 80.0, acos(a))) * vec3(1.0, 1.0, 0.5) * 4096.0 * 0.0;

	/*float t = frx_renderSeconds / (20.0 * 60.0 * 27.0);
	t += -frx_renderSeconds / (20.0 * 60.0);
	t *= 2.0 * PI;
	vec3 moon_pos = rotation(5.0 / 180.0 * PI, vec3(1.0, 0.0, 0.0)) * vec3(sin(t), cos(t), 0.0);
	sphere moon = sphere(
		vec3(0.0, -earth_radius, 0.0) + 384000000.0 * moon_pos, 17374000.0
	);*/

	/*ray_sphere_intersection_result eye_moon = ray_sphere_intersection(eye, moon);
	if(eye_moon.success && eye_moon.close > 0.0) {
		sphere earth = sphere(
			vec3(0.0, -earth_radius, 0.0), earth_radius
		);
		vec3 pos = eye.pos + dir * eye_moon.close;
		ray moon_to_sun = ray(pos, sun_dir());
		ray_sphere_intersection_result moon_earth = ray_sphere_intersection(moon_to_sun, earth);
		if(ray_sphere_intersection(ray(eye.pos, sun_dir()), moon).success) {
			s = vec3(0.0);
		}
		if(!moon_earth.success) {
			s += max(dot(normalize(pos - moon.pos), sun_dir()), 0.0) * 128.0;
		}
	}
	else {
		vec3 space_dir = rotation(frx_skyAngleRadians, vec3(0.0, 0.0, -1.0)) * dir;
		float hsh = hash13(vec3(ivec3(space_dir * 256.0)));
		s += pow(hsh, 2048.0) * 1.0;
	}*/

	return color + m;
}

vec3 end_sky(vec3 dir) {
	float dots = hash13(vec3(ivec3(dir * 1000.0)));
	dots = pow(dots, 64.0);
	vec3 rotated_0 = rotation(1.2, normalize(vec3(0.0, 0.0, 1.0))) * dir;
	vec3 rotated_1 = rotation(-PI / 4.0, normalize(vec3(0.0, 0.0, 1.0))) * dir;
	return
		vec3(0.5, 0.2, 0.2) * abs(dir.y) +
		vec3(0.2, 0.2, 0.8) * abs(rotated_0.y) +
		//vec3(0.0, 0.2, 0.0) * abs(rotated_1.y) +
		dots;
}

vec3 sky(vec3 dir) {
	if(frx_worldHasSkylight == 1) {
		if(frx_worldIsOverworld == 1) {
			return overworld_sky(dir, 1.0);
		}
		if(frx_worldIsEnd == 1) {
			return end_sky(dir);
		}
		return vec3(1.0);
	}
	return vec3(0.0);
}