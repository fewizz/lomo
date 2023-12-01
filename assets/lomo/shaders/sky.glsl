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
	vec3 coeffs;
	float height;
	float scale_height;
};

float ray_layer_intersection(ray r, layer l) {
	sphere top_sphere = sphere(
		vec3(0.0, -l.height, 0.0), l.height + (l.scale_height * 4.0)
	);
	sphere bot_sphere = sphere(
		vec3(0.0, -l.height, 0.0), l.height - 4000.0
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

const int steps = 16;

float oddl(vec3 pos, layer l) {
	float dist = distance(pos, vec3(0.0, -l.height, 0.0)) - l.height;
	return exp(-dist/l.scale_height);
}

float od(vec3 po, vec3 dir, layer l, float off) {
	sphere bot_sphere = sphere(
		vec3(0.0, -l.height, 0.0), l.height - 4000.0
	);
	ray_sphere_intersection_result bot = ray_sphere_intersection(ray(po, dir), bot_sphere);
	if(bot.success && bot.close >= 0.0) {
		return 100000000.0;
	}

	float dist = ray_layer_intersection(ray(po, dir), l);
	float stp = dist / float(steps);
	dist = 0.0;

	float result = 0.0;

	for(int i = 0; i < steps; ++i) {
		result += oddl(po+dir*(dist + stp*off), l) * stp;
		dist += stp;
	}
	return result;
}

float henyey_greenstein_phase_function(float g, float cosa) {
	return 3.0*(1.0-g*g)/(2.0*(2.0+g*g)) * (1.0+cosa*cosa)/pow(1.0+g*g-2.0*g*cosa, 3.0/2.0);
}

float rayleigh_phase_function(float cosa) {
	return 3.0 / (16.0 * PI) * (1.0 + cosa * cosa);
}

const float earth_radius = 6000000.0;

vec3 sky(ray r, float offset, float phase_r, float phase_m, bool sun) {
	vec3 rgb = vec3(7.2, 5.7, 4.2);
	layer rayleigh = layer(
		0.001 / pow(rgb, vec3(4.0)),
		earth_radius,
		8000.0
	);

	layer mie = layer(
		vec3(0.00000002),
		earth_radius,
		1200.0
	);

	vec3 result_rayleigh = vec3(0.0);
	vec3 result_mie = vec3(0.0);

	float od_rayleigh = 0.0;
	float od_mie = 0.0;

	float dist = ray_layer_intersection(r, rayleigh);
	float stp = dist / float(steps);
	dist = 0.0;

	for(int i = 0; i < steps; ++i) {
		vec3 p = r.pos + r.dir*(dist + stp*offset);

		float od0_rayleigh = oddl(p, rayleigh) * stp;
		float od0_mie      = oddl(p, mie) * stp;

		od_rayleigh += od0_rayleigh;
		od_mie      += od0_mie;

		ray r0 = ray(p, sun_dir());
		/*sphere bot_sphere = sphere(
			vec3(0.0, -earth_radius, 0.0), earth_radius - 4000.0
		);
		ray_sphere_intersection_result bot = ray_sphere_intersection(r0, bot_sphere);*/

		//if(!(bot.success && bot.close >= 0.0)) {

		//if(!sun) {
			vec3 tau =
				rayleigh.coeffs * (od_rayleigh + od(p, sun_dir(), rayleigh, offset)) +
				mie.coeffs *      (od_mie +      od(p, sun_dir(), mie,      offset));

			vec3 attenuation = exp(-tau);
			result_rayleigh += attenuation * od0_rayleigh * rayleigh.coeffs * phase_r;
			result_mie      += attenuation * od0_mie      * mie.coeffs      * phase_m;
		//}
		//else {
		//	result_rayleigh += od0_rayleigh * rayleigh.coeffs;
		//	result_mie      += od0_mie      * mie.coeffs;
		//}

		dist += stp;
	}

	vec3 s = vec3(80.0);

	vec3 result = s * (result_rayleigh + result_mie);
	if(sun) {
		result += vec3(70.0, 60.0, 40.0)*s*exp(
			-od(r.pos, r.dir, rayleigh, offset)*rayleigh.coeffs
			//-od(r.pos, mie, hsh.y)*mie.coeffs
		);
	}
	return result;
}

vec3 overworld_sky(vec3 dir, float offset) {
	vec3 eye_pos = frx_cameraPos;
	//eye_pos.y += 1000.0;
	eye_pos.x = 0.0; eye_pos.z = 0.0;
	ray eye = ray(eye_pos, dir);
	float a = dot(dir, sun_dir());
	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));
	//vec3 hsh = hash33(vec3(gl_FragCoord.xy, frx_renderSeconds));

	vec3 color = sky(
		eye,
		offset,
		rayleigh_phase_function(a),
		henyey_greenstein_phase_function(0.75, a),
		a > 0.9995
	);
	/*vec3 m = vec3(0.0);sky(
		eye,
		layer(earth_radius, 1200.0),
		vec3(0.01),
		hsh
	) * henyey_greenstein_phase_function(0.75, a);*/
	/*vec3 s = sky(
		eye,
		layer(earth_radius, 100.0),
		20.0/rgb,
		hsh
	) * step(0.999F, a)*200.0;*/
	//vec3 s = vec3(step(0.999F, a) * 220.0);

	//m *= sun_mul;

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
	//float sun = step(0.995F, a) * 20.0;

	return min(vec3(10000.0), color);//min(vec3(10000.0), (color + m + s) * 10.0);
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

vec3 sky(vec3 dir, float offset) {
	if(frx_worldHasSkylight == 1) {
		if(frx_worldIsOverworld == 1) {
			return overworld_sky(dir, offset);
		}
		if(frx_worldIsEnd == 1) {
			return end_sky(dir);
		}
		return vec3(1.0);
	}
	return vec3(0.0);
}